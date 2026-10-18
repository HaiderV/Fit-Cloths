import urllib.request
import json
import time

ports = {
    "Flask TailorVision": "http://127.0.0.1:5000/health",
    "Express Backend": "http://127.0.0.1:5001/api/ai/health",
    "FastAPI RAG API": "http://127.0.0.1:8000/health",
    "Ollama": "http://127.0.0.1:11434/api/tags"
}

for name, url in ports.items():
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            print(f"[{name}] status: {resp.status}, response: {resp.read().decode('utf-8')[:100]}")
    except Exception as e:
        print(f"[{name}] error or not listening: {e}")
