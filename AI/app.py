import os
import time
import uuid
import traceback
import requests
from flask import Flask, request, jsonify
from model import TailoredBodyModel
from fast_validator import validate_photo_deterministic

# Feature flag: enable Gemma LLM validation if explicitly requested via environment variable
USE_GEMMA = os.environ.get("USE_GEMMA_VALIDATION", "false").lower() == "true"
if USE_GEMMA:
    try:
        from gemma_validator import validate_photo as gemma_validate_photo
    except ImportError:
        gemma_validate_photo = None
else:
    gemma_validate_photo = None

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024  # 15 MB total

# Initialize MediaPipe once when the server starts (Singleton pattern)
body_model = TailoredBodyModel()


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "online",
        "service": "Fit Cloths Measurement Service",
        "validation_engine": "gemma_ollama" if USE_GEMMA else "fast_deterministic_cv",
        "endpoint": "/api/predict-measurements (POST)"
    })


@app.route("/api/predict-measurements", methods=["POST"])
def predict_measurements():
    t_start = time.perf_counter()
    correlation_id = request.headers.get("X-Correlation-ID") or request.headers.get("x-correlation-id") or str(uuid.uuid4())

    try:
        # 1. Check required uploads.
        t_recv = time.perf_counter()
        required_files = ["front_image", "side_image"]
        missing = [
            name for name in required_files
            if name not in request.files
            or not request.files[name].filename
        ]

        if missing:
            return jsonify({
                "status": "error",
                "message": f"Missing image files: {', '.join(missing)}"
            }), 400

        front_bytes = request.files["front_image"].read()
        side_bytes = request.files["side_image"].read()

        if not front_bytes or not side_bytes:
            return jsonify({
                "status": "error",
                "message": "One or both uploaded images are empty."
            }), 400

        # 2. Validate height.
        height_str = request.form.get("height_cm", "").strip()

        try:
            height_cm = float(height_str)
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "Provide a valid height_cm value."
            }), 400

        if not 100 <= height_cm <= 250:
            return jsonify({
                "status": "error",
                "message": "Height must be between 100 and 250 cm."
            }), 400

        # 3. Photo validation: fast deterministic CV (<0.2s) or Gemma if configured
        t_val_start = time.perf_counter()
        if USE_GEMMA and gemma_validate_photo is not None:
            front_check = gemma_validate_photo(front_bytes, "front")
            side_check = gemma_validate_photo(side_bytes, "right")
        else:
            front_check = validate_photo_deterministic(front_bytes, "front", detector=body_model.detector)
            side_check = validate_photo_deterministic(side_bytes, "right", detector=body_model.detector)
        t_val_end = time.perf_counter()

        checks = {
            "front": front_check,
            "side": side_check
        }

        rejected = {
            name: {
                "reason": result.get("reason", ""),
                "retake_instruction": result.get(
                    "retake_instruction", ""
                )
            }
            for name, result in checks.items()
            if not result.get("accepted", False)
        }

        if rejected:
            return jsonify({
                "status": "error",
                "stage": "photo_validation",
                "message": "Please retake the rejected photo(s).",
                "validation": checks,
                "retake": rejected
            }), 422

        # 4. Run the measurement model.
        t_infer_start = time.perf_counter()
        measurements = body_model.predict_all_measurements(
            front_img_bytes=front_bytes,
            side_img_bytes=side_bytes,
            user_height_cm=height_cm
        )
        t_infer_end = time.perf_counter()
        t_total = time.perf_counter() - t_start

        app.logger.info(
            f"[{correlation_id}] Prediction complete: total={t_total:.3f}s | "
            f"validation={t_val_end - t_val_start:.3f}s | inference={t_infer_end - t_infer_start:.3f}s"
        )

        resp = jsonify({
            "status": "success",
            "validation": checks,
            "data": measurements,
            "notice": (
                "Measurements are estimates and must be confirmed "
                "by the customer or tailor before garment production."
            ),
            "diagnostics": {
                "correlation_id": correlation_id,
                "total_duration_sec": round(t_total, 3),
                "validation_duration_sec": round(t_val_end - t_val_start, 3),
                "inference_duration_sec": round(t_infer_end - t_infer_start, 3),
            }
        })
        resp.headers["X-Correlation-ID"] = correlation_id
        resp.headers["X-Response-Time"] = f"{t_total * 1000:.1f}ms"
        return resp, 200

    except ValueError as exc:
        return jsonify({
            "status": "error",
            "message": str(exc)
        }), 422

    except requests.RequestException:
        app.logger.exception("Could not contact local Gemma through Ollama")
        return jsonify({
            "status": "error",
            "message": (
                "Photo validation service is unavailable. "
                "Ensure Ollama is running and retry."
            )
        }), 503

    except Exception:
        app.logger.error(traceback.format_exc())
        return jsonify({
            "status": "error",
            "message": "An unexpected server error occurred."
        }), 500


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({
        "status": "error",
        "message": "The uploaded images exceed the 15 MB request limit."
    }), 413


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
