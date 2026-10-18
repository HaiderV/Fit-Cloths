
from flask import Flask, request, jsonify
from model import TailoredBodyModel
from gemma_validator import validate_photo
import traceback
import requests

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024  # 15 MB total

# Initialize MediaPipe once when the server starts.
body_model = TailoredBodyModel()


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "online",
        "message": "Fit Cloths measurement service is running",
        "gemma": "Local photo validation enabled",
        "endpoint": "/api/predict-measurements (POST)"
    })


@app.route("/api/predict-measurements", methods=["POST"])
def predict_measurements():
    try:
        # 1. Check required uploads.
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

        # 3. Ask local Gemma to check each photo.
        front_check = validate_photo(front_bytes, "front")
        side_check = validate_photo(side_bytes, "right")

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

        # 4. Run the existing measurement model.
        measurements = body_model.predict_all_measurements(
            front_img_bytes=front_bytes,
            side_img_bytes=side_bytes,
            user_height_cm=height_cm
        )

        return jsonify({
            "status": "success",
            "validation": checks,
            "data": measurements,
            "notice": (
                "Measurements are estimates and must be confirmed "
                "by the customer or tailor before garment production."
            )
        }), 200

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
    app.run(host="127.0.0.1", port=5000, debug=True)


# to activate venv: .\.venv\Scripts\Activate.ps1
