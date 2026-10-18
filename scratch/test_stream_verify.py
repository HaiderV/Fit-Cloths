import urllib.request
import json

def test_stream_query(query):
    print(f"\n==================== Testing: '{query}' ====================")
    url = "http://127.0.0.1:5001/api/ai/chat?stream=true"
    payload = json.dumps({"message": query}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

    tokens = []
    products = []

    with urllib.request.urlopen(req) as resp:
        for line in resp:
            line_str = line.decode("utf-8").strip()
            if not line_str.startswith("data: "):
                continue
            event = json.loads(line_str[6:])
            if event.get("type") == "token":
                tokens.append(event.get("text", ""))
            elif event.get("type") == "products":
                products = event.get("products", [])

    full_text = "".join(tokens)
    print(f"Generated text: {full_text}")
    print(f"Products count: {len(products)}")
    if products:
        for p in products:
            print(f"  - [{p.get('product_code', 'N/A')}] {p.get('name')} (Rs. {p.get('price_inr')})")

test_stream_query("hi")
test_stream_query("give me some good trending cloths")
