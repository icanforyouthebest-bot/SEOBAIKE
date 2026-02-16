"""
SEOBAIKE x NVIDIA NIM -- local test
"""
import urllib.request
import json
import sys
import os
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding='utf-8')

API_KEY = "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"
URL = "https://integrate.api.nvidia.com/v1/chat/completions"

MODELS = [
    "meta/llama-3.1-8b-instruct",
    "deepseek-ai/deepseek-v3.2",
    "google/gemma-3-27b-it",
    "microsoft/phi-4-mini-instruct",
    "qwen/qwen3-235b-a22b",
    "mistralai/mistral-large-3-675b-instruct-2512",
]

prompt = sys.argv[1] if len(sys.argv) > 1 else "Describe SEOBAIKE platform in one sentence"

print(f"=== SEOBAIKE × NVIDIA NIM 測試 ===")
print(f"問題: {prompt}")
print()

passed = 0
failed = 0

for model in MODELS:
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 100
    }).encode()

    req = urllib.request.Request(URL, data=payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    })

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            choices = result.get("choices", [])
            if not choices:
                print(f"[FAIL] {model}: no choices in response")
                failed += 1
                print()
                continue
            content = choices[0].get("message", {}).get("content", "")[:80]
            print(f"[OK] {model}")
            print(f"     {content}")
            passed += 1
    except Exception as e:
        print(f"[FAIL] {model}: {e}")
        failed += 1
    print()

print(f"=== 結果: {passed} 通過 / {failed} 失敗 / {len(MODELS)} 總計 ===")
