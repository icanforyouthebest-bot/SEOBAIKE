"""
SEOBAIKE AI Chat - local terminal
type question, get AI answer. type 'quit' to exit.
"""
import urllib.request
import json
import sys
import os
sys.stdout.reconfigure(encoding='utf-8')

API_KEY = "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"
URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODEL = "deepseek-ai/deepseek-v3.2"

history = [{"role": "system", "content": "You are SEOBAIKE AI assistant. Answer in the user's language. Be concise."}]

print("=== SEOBAIKE AI Chat (NVIDIA NIM) ===")
print(f"Model: {MODEL}")
print("Type 'quit' to exit\n")

while True:
    try:
        q = input("YOU> ").strip()
    except (EOFError, KeyboardInterrupt):
        break
    if not q or q.lower() in ('quit', 'exit', 'q'):
        break

    history.append({"role": "user", "content": q})
    payload = json.dumps({"model": MODEL, "messages": history, "max_tokens": 500}).encode()
    req = urllib.request.Request(URL, data=payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            answer = result["choices"][0]["message"]["content"]
            history.append({"role": "assistant", "content": answer})
            print(f"\nAI> {answer}\n")
    except Exception as e:
        print(f"\n[ERROR] {e}\n")

print("Bye.")
