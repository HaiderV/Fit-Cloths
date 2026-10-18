import urllib.request
import json

def test_chat(msg):
    req = urllib.request.Request(
        'http://127.0.0.1:5001/api/ai/chat',
        data=json.dumps({'message': msg}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"Query: '{msg}'")
        print(f"Products count: {len(data.get('products', []))}")
        print(f"AI Reply: {data.get('reply', '')[:140]}...\n")

print('--- Test 1: Greeting ---')
test_chat('hello')

print('--- Test 2: Product Suggestion Request ---')
test_chat('what all are trending right now')
