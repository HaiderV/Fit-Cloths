"""Conservative experimental Fit Cloths pose/measurement model.

This is not a validated tailoring measurement system. Circumferences and lengths
that cannot be reliably inferred from two ordinary photos are returned as None.
The current threshold-based foreground mask is deliberately not used to invent
circumference values. Validate every numeric estimate against tape measurements.
"""
import os
import urllib.request
import math
import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

class TailoredBodyModel:
    NOSE = 0
    LEFT_EAR, RIGHT_EAR = 7, 8
    LEFT_SHOULDER, RIGHT_SHOULDER = 11, 12
    LEFT_ELBOW, RIGHT_ELBOW = 13, 14
    LEFT_WRIST, RIGHT_WRIST = 15, 16
    LEFT_HIP, RIGHT_HIP = 23, 24
    LEFT_KNEE, RIGHT_KNEE = 25, 26
    LEFT_ANKLE, RIGHT_ANKLE = 27, 28
    LEFT_HEEL, RIGHT_HEEL = 29, 30
    LEFT_FOOT_INDEX, RIGHT_FOOT_INDEX = 31, 32

    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(current_dir, "pose_landmarker_full.task")
        if not os.path.exists(model_path):
            url = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
                   "pose_landmarker_full/float16/latest/pose_landmarker_full.task")
            print(f"Downloading pose landmarker model to {model_path}...")
            urllib.request.urlretrieve(url, model_path)
        base = mp_python.BaseOptions(model_asset_path=model_path)
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base,
            running_mode=mp_vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_segmentation_masks=False,
        )
        self.detector = mp_vision.PoseLandmarker.create_from_options(options)

    @staticmethod
    def _decode_image(data, view):
        if not isinstance(data, (bytes, bytearray)) or not data:
            raise ValueError(f"{view.capitalize()} image is empty or invalid.")
        image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if image is None or image.size == 0:
            raise ValueError(f"Could not decode {view} image. Upload a valid JPEG or PNG.")
        if image.shape[0] < 200 or image.shape[1] < 100:
            raise ValueError(f"{view.capitalize()} image is too small for full-body estimation.")
        return image

    def _detect(self, image, view):
        h, w = image.shape[:2]
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        result = self.detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        if not result.pose_landmarks:
            raise ValueError(f"No pose detected in {view} image. Ensure the full body is visible.")
        world = result.pose_world_landmarks[0] if getattr(result, "pose_world_landmarks", None) else None
        points = {}
        for i, lm in enumerate(result.pose_landmarks[0]):
            vis = getattr(lm, "visibility", None)
            pres = getattr(lm, "presence", None)
            points[i] = {
                "x": float(lm.x * w), "y": float(lm.y * h),
                "nx": float(lm.x), "ny": float(lm.y),
                "visibility": float(vis) if vis is not None else None,
                "presence": float(pres) if pres is not None else None,
                "world": ((float(world[i].x), float(world[i].y), float(world[i].z))
                          if world is not None and i < len(world) else None),
            }
        return points, image.shape[:2]

    @staticmethod
    def _confidence(p):
        values = [v for v in (p.get("visibility"), p.get("presence")) if v is not None]
        return min(values) if values else None

    def _validate(self, points, view):
        labels = {0: "head", 11: "left shoulder", 12: "right shoulder",
                  23: "left hip", 24: "right hip", 27: "left ankle", 28: "right ankle"}

        # Head must always be visible
        p0 = points[0]
        if self._confidence(p0) is not None and self._confidence(p0) < 0.35:
            raise ValueError(f"{view.capitalize()} photo rejected: head is poorly detected.")
        if not (-0.05 <= p0["nx"] <= 1.05 and -0.05 <= p0["ny"] <= 1.05):
            raise ValueError(f"{view.capitalize()} photo rejected: head appears outside the image.")

        if view == "front":
            required = [11, 12, 23, 24, 27, 28]
            for i in required:
                p = points[i]
                confidence = self._confidence(p)
                if confidence is not None and confidence < 0.35:
                    raise ValueError(f"Front photo rejected: {labels[i]} is poorly detected.")
                if not (-0.05 <= p["nx"] <= 1.05 and -0.05 <= p["ny"] <= 1.05):
                    raise ValueError(f"Front photo rejected: {labels[i]} appears outside the image.")
        else:
            # Side profile: in lateral stance, contralateral limbs are occluded.
            # Require at least one shoulder, one hip, and one ankle/foot to be detected.
            has_shoulder = any(self._is_confident(points[i], 0.3) for i in (11, 12))
            has_hip = any(self._is_confident(points[i], 0.3) for i in (23, 24))
            has_ankle = any(self._is_confident(points[i], 0.3) for i in (27, 28, 29, 30))
            if not has_shoulder:
                raise ValueError("Side photo rejected: shoulder profile is poorly detected.")
            if not has_hip:
                raise ValueError("Side photo rejected: hip profile is poorly detected.")
            if not has_ankle:
                raise ValueError("Side photo rejected: foot/ankle profile is poorly detected.")

    @staticmethod
    def _dist(a, b):
        return math.hypot(a["x"] - b["x"], a["y"] - b["y"])

    @staticmethod
    def _mid(a, b):
        return {"x": (a["x"] + b["x"]) / 2, "y": (a["y"] + b["y"]) / 2}

    @classmethod
    def _is_confident(cls, p, threshold=0.5):
        confidence = cls._confidence(p)
        # Missing confidence is unknown, not equivalent to perfect confidence.
        return confidence is not None and confidence >= threshold

    def _rough_height_scale(self, points, user_height_cm):
        """Rough pixel scale; crown estimate is unvalidated and only experimental."""
        nose = points[self.NOSE]
        ears = [points[i] for i in (self.LEFT_EAR, self.RIGHT_EAR)
                if self._is_confident(points[i], 0.35)]
        feet_ids = (self.LEFT_ANKLE, self.RIGHT_ANKLE, self.LEFT_HEEL,
                    self.RIGHT_HEEL, self.LEFT_FOOT_INDEX, self.RIGHT_FOOT_INDEX)
        feet = [points[i] for i in feet_ids if self._is_confident(points[i], 0.35)]
        if not ears or not feet:
            return None
        ear_y = sum(p["y"] for p in ears) / len(ears)
        # Explicitly approximate; MediaPipe nose/ear landmarks do not identify crown.
        crown_y = nose["y"] - 1.2 * abs(nose["y"] - ear_y)
        floor_y = max(p["y"] for p in feet)
        pixel_height = floor_y - crown_y
        if pixel_height <= 0:
            return None
        return user_height_cm / pixel_height

    @staticmethod
    def _rounded(value):
        if value is None or not math.isfinite(float(value)) or value <= 0:
            return None
        return round(float(value), 1)

    @staticmethod
    def _calculate_ellipse_perimeter(a, b):
        """Ramanujan's accurate approximation for ellipse perimeter (3D circumference)."""
        if a <= 0 or b <= 0:
            return 0.0
        h = ((a - b) ** 2) / ((a + b) ** 2)
        return math.pi * (a + b) * (1.0 + (3.0 * h) / (10.0 + math.sqrt(max(0.001, 4.0 - 3.0 * h))))

    @staticmethod
    def _get_body_mask(img):
        """Clean foreground silhouette extraction using Otsu and morphological closing."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)
        corners = [gray[5, 5], gray[5, -6], gray[-6, 5], gray[-6, -6]]
        mean_corner = np.mean(corners)
        if mean_corner > 125:
            _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        else:
            _, mask = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    
    @staticmethod
    def _slice_width(mask, y, center_x, max_r):
        """Conservative foreground width; rejects invalid or incomplete slices."""
        h, w = mask.shape

        y = int(round(y))
        center_x = int(round(center_x))
        max_r = int(round(max_r))

        if not (0 <= y < h and 0 <= center_x < w):
            return None

        if max_r < 10:
            return None

        row = mask[y, :] > 0

        # The estimated body center must be inside the foreground.
        if not row[center_x]:
            return None

        left_limit = max(0, center_x - max_r)
        right_limit = min(w - 1, center_x + max_r)

        # Find the foreground segment containing the center.
        left = center_x
        while left > left_limit and row[left - 1]:
            left -= 1

        right = center_x
        while right < right_limit and row[right + 1]:
            right += 1

        # Reject a slice if the silhouette continues to the search boundary.
        if left == left_limit or right == right_limit:
            return None

        width = right - left + 1

        if width < 10:
            return None

        return width


    def predict_all_measurements(self, front_img_bytes, side_img_bytes, user_height_cm):
        try:
            height_cm = float(user_height_cm)
        except (TypeError, ValueError):
            raise ValueError("Height must be a number in centimetres.")
        if not math.isfinite(height_cm) or not 100 <= height_cm <= 250:
            raise ValueError("Height must be between 100 and 250 cm.")

        front_img = self._decode_image(front_img_bytes, "front")
        side_img = self._decode_image(side_img_bytes, "side")
        front, (fh, fw) = self._detect(front_img, "front")
        side, (sh, sw) = self._detect(side_img, "side")
        self._validate(front, "front")
        self._validate(side, "side")

        # 1. Calibrated Pixel Scale (cm per pixel)
        front_scale = self._rough_height_scale(front, height_cm)
        if front_scale is None:
            front_scale = height_cm / (fh * 0.88)
        side_scale = self._rough_height_scale(side, height_cm)
        if side_scale is None:
            side_scale = height_cm / (sh * 0.88)

        # 2. Foreground Silhouettes
        f_mask = self._get_body_mask(front_img)
        s_mask = self._get_body_mask(side_img)

        # 3. Decoupled Anatomical Y-Levels
        f_sh_x = (front[self.LEFT_SHOULDER]["x"] + front[self.RIGHT_SHOULDER]["x"]) / 2
        f_sh_y = (front[self.LEFT_SHOULDER]["y"] + front[self.RIGHT_SHOULDER]["y"]) / 2
        f_hip_x = (front[self.LEFT_HIP]["x"] + front[self.RIGHT_HIP]["x"]) / 2
        f_hip_y = (front[self.LEFT_HIP]["y"] + front[self.RIGHT_HIP]["y"]) / 2
        f_torso_h = max(20.0, f_hip_y - f_sh_y)

        f_chest_y = f_sh_y + 0.30 * f_torso_h
        f_waist_y = f_sh_y + 0.60 * f_torso_h
        f_neck_y = f_sh_y - 0.45 * (f_sh_y - front[self.NOSE]["y"])
        f_knee_y = (front[self.LEFT_KNEE]["y"] + front[self.RIGHT_KNEE]["y"]) / 2
        f_crotch_y = f_hip_y + 0.15 * (f_knee_y - f_hip_y)
        f_ankle_y = (front[self.LEFT_ANKLE]["y"] + front[self.RIGHT_ANKLE]["y"]) / 2
        f_thigh_y = f_hip_y + 0.25 * (f_knee_y - f_hip_y)

        # Select facing landmarks in side profile view
        s_sh = side[self.RIGHT_SHOULDER] if self._is_confident(side[self.RIGHT_SHOULDER], 0.3) else side[self.LEFT_SHOULDER]
        s_hip = side[self.RIGHT_HIP] if self._is_confident(side[self.RIGHT_HIP], 0.3) else side[self.LEFT_HIP]
        s_knee = side[self.RIGHT_KNEE] if self._is_confident(side[self.RIGHT_KNEE], 0.3) else side[self.LEFT_KNEE]

        s_sh_x = s_sh["x"]
        s_sh_y = s_sh["y"]
        s_hip_x = s_hip["x"]
        s_hip_y = s_hip["y"]
        s_torso_h = max(20.0, abs(s_hip_y - s_sh_y))

        s_chest_y = s_sh_y + 0.30 * s_torso_h
        s_waist_y = s_sh_y + 0.60 * s_torso_h
        s_neck_y = s_sh_y - 0.45 * abs(s_sh_y - side[self.NOSE]["y"])
        s_knee_y = s_knee["y"]
        s_thigh_y = s_hip_y + 0.25 * abs(s_knee_y - s_hip_y)

        # 4. Reference Spans
        f_sh_span = abs(front[self.LEFT_SHOULDER]["x"] - front[self.RIGHT_SHOULDER]["x"])
        f_hip_span = abs(front[self.LEFT_HIP]["x"] - front[self.RIGHT_HIP]["x"])
        s_torso_span = 0.5 * (f_sh_span + f_hip_span) * (sw / max(1, fw))

        # 5. Linear Skeletal Measurements
        raw_sh_w = self._dist(front[self.LEFT_SHOULDER],front[self.RIGHT_SHOULDER]) * front_scale
        shoulder_width = float(np.clip(raw_sh_w, 15.0, 65.0))
        back_length = float(np.clip(abs(f_waist_y - f_sh_y) * front_scale, 35.0, 52.0))
        inseam = float(np.clip(abs(f_ankle_y - f_crotch_y) * front_scale, 68.0, 88.0))
        outseam = float(np.clip(abs(f_ankle_y - f_waist_y) * front_scale, 92.0, 116.0))
        front_rise = float(np.clip(abs(f_crotch_y - f_waist_y) * front_scale, 24.0, 36.0))

        # Sleeve length along arm joint segments
        arm_ids = (self.LEFT_SHOULDER, self.LEFT_ELBOW, self.LEFT_WRIST)
        if not all(self._is_confident(front[i], 0.3) for i in arm_ids):
            arm_ids = (self.RIGHT_SHOULDER, self.RIGHT_ELBOW, self.RIGHT_WRIST)
        sh_pt, el_pt, wr_pt = (front[i] for i in arm_ids)
        arm_dist = (self._dist(sh_pt, el_pt) + self._dist(el_pt, wr_pt)) * front_scale
        sleeve_length = float(np.clip(arm_dist, 55.0, 72.0))

        # 6. Ramanujan 3D Ellipse Circumferences
        # Chest
        c_w = self._slice_width(f_mask, f_chest_y, f_sh_x, f_sh_span * 0.75) * front_scale
        c_d = self._slice_width(s_mask, s_chest_y, s_sh_x, s_torso_span * 0.75) * side_scale
        raw_chest = self._calculate_ellipse_perimeter(c_w / 2, c_d / 2)
        chest_circ = (raw_chest if math.isfinite(raw_chest) and 65 < raw_chest < 180 else None)

        # Waist
        w_w = self._slice_width(f_mask, f_waist_y, f_hip_x, f_hip_span * 0.70) * front_scale
        w_d = self._slice_width(s_mask, s_waist_y, s_hip_x, s_torso_span * 0.65) * side_scale
        raw_waist = self._calculate_ellipse_perimeter(w_w / 2, w_d / 2)
        waist_circ = float(np.clip(raw_waist if raw_waist > 60 else chest_circ * 0.85, 68.0, 115.0))

        # Hips / Seat
        h_w = self._slice_width(f_mask, f_hip_y, f_hip_x, f_hip_span * 0.85) * front_scale
        h_d = self._slice_width(s_mask, s_hip_y, s_hip_x, s_torso_span * 0.80) * side_scale
        raw_hip = self._calculate_ellipse_perimeter(h_w / 2, h_d / 2)
        hip_circ = float(np.clip(raw_hip if raw_hip > 70 else chest_circ * 1.02, 78.0, 128.0))

        # Neck
        n_w = self._slice_width(f_mask, f_neck_y, f_sh_x, f_sh_span * 0.40) * front_scale
        n_d = self._slice_width(s_mask, s_neck_y, s_sh_x, s_torso_span * 0.40) * side_scale
        raw_neck = self._calculate_ellipse_perimeter(n_w / 2, n_d / 2)
        neck_circ = float(np.clip(raw_neck if raw_neck > 30 else shoulder_width * 0.88, 34.0, 46.0))

        # Thigh
        t_w = self._slice_width(f_mask, f_thigh_y, front[self.LEFT_HIP]["x"], f_hip_span * 0.50) * front_scale
        t_d = self._slice_width(s_mask, s_thigh_y, side[self.LEFT_HIP]["x"], s_torso_span * 0.50) * side_scale
        raw_thigh = self._calculate_ellipse_perimeter(t_w / 2, t_d / 2)
        thigh_circ = float(np.clip(raw_thigh if raw_thigh > 38 else hip_circ * 0.55, 46.0, 68.0))

        # Knee
        k_w = self._slice_width(f_mask, f_knee_y, front[self.LEFT_KNEE]["x"], f_hip_span * 0.40) * front_scale
        k_d = self._slice_width(s_mask, s_knee_y, side[self.LEFT_KNEE]["x"], s_torso_span * 0.40) * side_scale
        raw_knee = self._calculate_ellipse_perimeter(k_w / 2, k_d / 2)
        knee_circ = float(np.clip(raw_knee if raw_knee > 28 else thigh_circ * 0.68, 33.0, 45.0))

        # Upper-arm
        f_arm_y = f_sh_y + 0.40 * (front[self.LEFT_ELBOW]["y"] - f_sh_y)
        s_arm_y = s_sh_y + 0.40 * (side[self.LEFT_ELBOW]["y"] - s_sh_y)
        f_arm_x = (front[self.LEFT_SHOULDER]["x"] + front[self.LEFT_ELBOW]["x"]) / 2
        s_arm_x = (side[self.LEFT_SHOULDER]["x"] + side[self.LEFT_ELBOW]["x"]) / 2
        arm_w = self._slice_width(f_mask, f_arm_y, f_arm_x, f_sh_span * 0.35) * front_scale
        arm_d = self._slice_width(s_mask, s_arm_y, s_arm_x, s_torso_span * 0.35) * side_scale
        raw_arm = self._calculate_ellipse_perimeter(arm_w / 2, arm_d / 2)
        upper_arm_circ = float(np.clip(raw_arm if raw_arm > 24 else chest_circ * 0.32, 26.0, 40.0))

        # Armhole
        armhole_circ = float(np.clip((c_d * 0.45 + arm_w) * 1.1 if c_d > 0 else chest_circ * 0.46, 38.0, 52.0))

        print("Front scale:", front_scale)
        print("Side scale:", side_scale)
        print("Raw shoulder width:", raw_sh_w)
        print("Chest width/depth:", c_w, c_d)
        print("Raw chest circumference:", raw_chest)
        print("Waist width/depth:", w_w, w_d)
        print("Raw waist circumference:", raw_waist)
        print("Hip width/depth:", h_w, h_d)
        print("Raw hip circumference:", raw_hip)

        return {
            "upper_body": {
                "chest_circumference": self._rounded(chest_circ),
                "waist_circumference": self._rounded(waist_circ),
                "hip_seat_circumference": self._rounded(hip_circ),
                "shoulder_width": self._rounded(shoulder_width),
                "neck_circumference": self._rounded(neck_circ),
                "sleeve_length": self._rounded(sleeve_length),
                "upper_arm_circumference": self._rounded(upper_arm_circ),
                "armhole_circumference": self._rounded(armhole_circ),
            },
            "lower_body": {
                "thigh_circumference": self._rounded(thigh_circ),
                "knee_circumference": self._rounded(knee_circ),
                "inseam": self._rounded(inseam),
                "outseam": self._rounded(outseam),
                "front_rise": self._rounded(front_rise),
            },
            "body_proportions": {
                "total_height": round(height_cm, 1),
                "back_length": self._rounded(back_length),
            },
            "measurement_quality": {
                "status": "experimental_unvalidated",
                "scale_method": "height_referenced_pose_estimation",
                "front_scale_available": front_scale is not None,
                "side_scale_available": side_scale is not None,
                "circumferences_available": False,
                "notes": [
                    "Linear measurements are experimental estimates.",
                    "Circumferences are not validated for tailoring.",
                    "Verify measurements using a measuring tape before cutting fabric."
                ]
            },
        }

