"""
scratch/benchmark_end_to_end.py
===============================
Rigorous, empirical end-to-end benchmarking script for Fit Cloths:
- Workflow A: Express -> TailorVision Flask (/api/measurements/predict)
- Workflow B: Express -> FastAPI RAG -> Ollama (/api/ai/chat)
Records cold start, warm run 1, warm run 2, TTFT, stage timings, and status codes.
"""

import time
import json
import urllib.request
import urllib.error
import mimetypes
import uuid
from pathlib import Path


def create_multipart_formdata(fields, files):
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body = bytearray()

    for k, v in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{k}"\r\n\r\n'.encode("utf-8"))
        body.extend(f"{v}\r\n".encode("utf-8"))

    for field_name, (filename, file_bytes) in files.items():
        mimetype = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode("utf-8"))
        body.extend(f"Content-Type: {mimetype}\r\n\r\n".encode("utf-8"))
        body.extend(file_bytes)
        body.extend(b"\r\n")

    body.extend(f"--{boundary}--\r\n".encode("utf-8"))
    content_type = f"multipart/form-data; boundary={boundary}"
    return content_type, bytes(body)


def benchmark_workflow_a():
    print("\n" + "="*70)
    print("BENCHMARKING WORKFLOW A: Body Measurement Prediction (/api/measurements/predict)")
    print("="*70)

    url = "http://127.0.0.1:5001/api/measurements/predict"
    img_dir = Path("tailoring-grade_anthropometric_Python_tool/images")
    front_path = img_dir / "sample2_front.jpg"
    side_path = img_dir / "sample2_side.jpg"

    if not front_path.exists() or not side_path.exists():
        print(f"Error: Sample images not found in {img_dir}")
        return

    with open(front_path, "rb") as f:
        front_bytes = f.read()
    with open(side_path, "rb") as f:
        side_bytes = f.read()

    fields = {
        "height_cm": "178",
        "gender": "male",
        "garment_type": "suit"
    }
    files = {
        "front_image": ("front.jpg", front_bytes),
        "side_image": ("side.jpg", side_bytes)
    }

    content_type, body = create_multipart_formdata(fields, files)

    runs = ["Run 1 (Cold / Initial)", "Run 2 (Warm 1)", "Run 3 (Warm 2)"]
    durations = []

    for label in runs:
        print(f"\n--- Starting {label} ---")
        corr_id = f"bench-wfA-{uuid.uuid4().hex[:8]}"
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("Content-Type", content_type)
        req.add_header("X-Correlation-ID", corr_id)

        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                elapsed = time.perf_counter() - t0
                status = resp.status
                raw_data = resp.read().decode("utf-8")
                durations.append(elapsed)
                data = json.loads(raw_data)
                
                print(f"Status: {status} OK in {elapsed:.2f}s")
                diag = data.get("diagnostics", {})
                print(f"Express Duration: {diag.get('express_total_ms', 'N/A')}ms")
                print(f"Flask Duration:   {diag.get('flask_total_sec', 'N/A')}s")
                if "stages_ms" in diag:
                    for stage, ms in diag["stages_ms"].items():
                        print(f"  - Stage '{stage}': {ms:.1f}ms")
                
                measurements = data.get("data", {})
                print(f"Predicted Measurements sample: chest={measurements.get('chest')}, waist={measurements.get('waist')}, hip={measurements.get('hip')}, height={measurements.get('height')}")
        except Exception as e:
            elapsed = time.perf_counter() - t0
            print(f"Failed after {elapsed:.2f}s: {e}")

    return durations


def benchmark_workflow_b():
    print("\n" + "="*70)
    print("BENCHMARKING WORKFLOW B: Gemma Fashion/Tailoring Agent with RAG (/api/ai/chat)")
    print("="*70)

    url = "http://127.0.0.1:5001/api/ai/chat"
    queries = [
        "What formal suits or shirts do you recommend for an evening gala?",
        "Recommend traditional sherwani or kurta for a wedding celebration"
    ]

    durations = []

    for i, q in enumerate(queries):
        label = f"Query {i+1} ({'Initial / Cold' if i == 0 else 'Warm'}): '{q[:40]}...'"
        print(f"\n--- Starting {label} ---")
        payload = json.dumps({"message": q}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("X-Correlation-ID", f"bench-wfB-{uuid.uuid4().hex[:8]}")

        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                elapsed = time.perf_counter() - t0
                status = resp.status
                raw = resp.read().decode("utf-8")
                durations.append(elapsed)
                data = json.loads(raw)

                print(f"Status: {status} OK in {elapsed:.2f}s")
                timings = data.get("timings", {})
                print(f"RAG search latency:  {timings.get('rag_search_ms', 'N/A')}ms")
                print(f"Ollama latency:      {timings.get('ollama_ms', 'N/A')}ms")
                print(f"Total API latency:   {timings.get('total_ms', 'N/A')}ms")
                print(f"Products retrieved:  {len(data.get('products', []))}")
                reply_snippet = data.get("reply", "").replace("\n", " ")[:150]
                print(f"AI Reply snippet:    \"{reply_snippet}...\"")
        except Exception as e:
            elapsed = time.perf_counter() - t0
            print(f"Failed after {elapsed:.2f}s: {e}")

    # Also benchmark streaming response TTFT
    print("\n--- Benchmarking Stream Time-To-First-Token (TTFT) ---")
    stream_url = "http://127.0.0.1:5001/api/ai/chat?stream=true"
    payload = json.dumps({"message": "Tell me about lightweight linen shirts"}).encode("utf-8")
    req = urllib.request.Request(stream_url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")

    t0 = time.perf_counter()
    ttft = None
    first_visible_token_time = None
    total_chunks = 0

    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            for line in resp:
                line_str = line.decode("utf-8").strip()
                if not line_str or not line_str.startswith("data:"):
                    continue
                data_part = line_str[5:].strip()
                if data_part == "[DONE]":
                    break
                total_chunks += 1
                if ttft is None:
                    ttft = time.perf_counter() - t0
                try:
                    parsed = json.loads(data_part)
                    if parsed.get("token") and first_visible_token_time is None:
                        first_visible_token_time = time.perf_counter() - t0
                except Exception:
                    pass
        total_time = time.perf_counter() - t0
        print(f"Streaming completed in {total_time:.2f}s")
        print(f"Time to First Chunk (thinking/meta): {ttft:.3f}s" if ttft else "No chunks received")
        print(f"Time to First Content Token:        {first_visible_token_time:.3f}s" if first_visible_token_time else f"TTFT: {ttft:.3f}s")
    except Exception as e:
        print(f"Streaming error: {e}")


if __name__ == "__main__":
    benchmark_workflow_a()
    benchmark_workflow_b()
