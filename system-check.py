"""
SEOBAIKE System Check -- all platforms from local machine
"""
import urllib.request
import json
import sys
import os
sys.stdout.reconfigure(encoding='utf-8')

def test_url(name, url, method="GET", data=None, headers=None):
    h = headers or {}
    if data:
        h["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=h, method=method)
    else:
        req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            return resp.status, body
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()[:100]}
    except Exception as e:
        return 0, {"error": str(e)}

print("=" * 60)
print("SEOBAIKE SYSTEM CHECK - from local machine")
print("=" * 60)
results = []

# 1. Azure Functions
print("\n[1] AZURE FUNCTIONS")
for name, url in [
    ("L1-L4 Pipeline", "https://seobaike-l1l4-pipeline.azurewebsites.net/api/health"),
    ("AI Router", "https://seobaike-ai-router.azurewebsites.net/api/health"),
]:
    code, body = test_url(name, url)
    status = "OK" if code == 200 else "FAIL"
    print(f"  [{status}] {name}: {code}")
    results.append((name, status))

# 2. NVIDIA NIM
print("\n[2] NVIDIA NIM")
nv_code, nv_body = test_url("NVIDIA", "https://integrate.api.nvidia.com/v1/chat/completions", "POST",
    {"model": "meta/llama-3.1-8b-instruct", "messages": [{"role": "user", "content": "Say OK"}], "max_tokens": 5},
    {"Authorization": "Bearer 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"})
nv_status = "OK" if nv_code == 200 else "FAIL"
nv_content = nv_body.get("choices", [{}])[0].get("message", {}).get("content", "")[:30] if nv_code == 200 else str(nv_body)[:50]
print(f"  [{nv_status}] NVIDIA NIM: {nv_code} -> {nv_content}")
results.append(("NVIDIA NIM", nv_status))

# 3. Supabase
print("\n[3] SUPABASE")
sb_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg"
sb_url = "https://vmyrivxxibqydccurxug.supabase.co"

for table in ["l1_categories", "l2_subcategories", "ai_providers", "app_secrets"]:
    code, body = test_url(f"Supabase:{table}", f"{sb_url}/rest/v1/{table}?select=count&limit=1",
        headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"})
    count = len(body) if isinstance(body, list) else 0
    status = "OK" if code == 200 else "FAIL"
    print(f"  [{status}] {table}: {code}")
    results.append((f"Supabase:{table}", status))

# 4. Cloudflare Workers
print("\n[4] CLOUDFLARE")
for cf_name, cf_url in [
    ("aiforseo.vip", "https://aiforseo.vip/"),
    ("API", "https://api.aiforseo.vip/api/providers"),
]:
    try:
        r = urllib.request.urlopen(urllib.request.Request(cf_url), timeout=15)
        cf_code = r.status
    except urllib.error.HTTPError as e:
        cf_code = e.code
    except:
        cf_code = 0
    cf_status = "OK" if 200 <= cf_code < 500 else "FAIL"
    print(f"  [{cf_status}] {cf_name}: {cf_code}")
    results.append((f"CF:{cf_name}", cf_status))

# 5. Azure Key Vault (existence check via management API won't work without token, skip)

# Summary
print("\n" + "=" * 60)
ok = sum(1 for _, s in results if s == "OK")
fail = sum(1 for _, s in results if s == "FAIL")
print(f"TOTAL: {ok} OK / {fail} FAIL / {len(results)} CHECKED")
print("=" * 60)

# Write results to file
with open("system-check-result.json", "w", encoding="utf-8") as f:
    json.dump({"results": [{"name": n, "status": s} for n, s in results], "ok": ok, "fail": fail}, f, ensure_ascii=False, indent=2)
print("Results saved to: system-check-result.json")
