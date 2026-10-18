
import base64
import json
import requests

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "gemma4:e2b"


def validate_photo(image_bytes, expected_view):
    """
    Ask local Gemma to check a body photo before measurement.
    expected_view: front, back, left, or right
    """

    if expected_view not in {"front", "back", "left", "right"}:
        raise ValueError("Invalid view. Use front, back, left, or right.")

    encoded_image = base64.b64encode(image_bytes).decode("utf-8")

    prompt = f"""
    You are a photo-quality checker for Fit Cloths, a custom-tailoring app.

    Analyze the attached photo. The expected view is: {expected_view}.

    Return JSON only with these fields:
    {{
      "full_body_visible": true,
      "view_matches": true,
      "single_person": true,
      "suitable_for_measurement": true,
      "reason": "Short explanation",
      "retake_instruction": ""
    }}

    Rules:
    - Use true or false for the four boolean fields.
    - Check whether one person's body is visible from head to feet.
    - Check whether the visible orientation matches the expected view.
    - If the view is unclear, do not assume it matches.
    - Judge only what is visible; do not estimate body measurements.
    - If unsuitable, explain what the user should correct.
    """

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [encoded_image],
                }
            ],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0},
        },
        timeout=180,
    )

    response.raise_for_status()
    result = response.json()["message"]["content"]
    result = json.loads(result)

    required_fields = [
        "full_body_visible",
        "view_matches",
        "single_person",
        "suitable_for_measurement",
        "reason",
        "retake_instruction",
    ]

    if not all(field in result for field in required_fields):
        raise ValueError("Gemma returned an incomplete validation result.")

    for field in required_fields[:4]:
        if not isinstance(result[field], bool):
            raise ValueError(f"Invalid boolean returned for {field}.")

    result["accepted"] = all(result[field] for field in required_fields[:4])
    return result
