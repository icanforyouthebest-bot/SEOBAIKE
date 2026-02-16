"""
SEOBAIKE Local Status - terminal dashboard
"""
import urllib.request
import json
import sys
import os
from datetime import datetime
sys.stdout.reconfigure(encoding='utf-8')

SB_URL = "https://vmyrivxxibqydccurxug.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg"
NV_KEY = "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"

def sb_get(path):
    r = urllib.request.Request(f"{SB_URL}/rest/v1/{path}", headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return json.loads(resp.read())
    except:
        return []

def http_check(url, timeout=10):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url), timeout=timeout)
        return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except:
        return 0

print("=" * 60)
print(f"  SEOBAIKE LOCAL STATUS - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 60)

# L1-L4 Patent Data
print("\n[PATENT L1-L4 DATA]")
l1 = sb_get("l1_categories?select=id,name&order=id&limit=30")
print(f"  L1 Categories: {len(l1)}")
for item in l1[:5]:
    print(f"    {item['id']}. {item['name']}")
if len(l1) > 5:
    print(f"    ... +{len(l1)-5} more")

l2 = sb_get("l2_subcategories?select=count")
l3 = sb_get("l3_processes?select=count")
l4 = sb_get("l4_nodes?select=count")
print(f"  L2 Subcategories: {len(l2)}")
print(f"  L3 Processes: {len(l3)}")
print(f"  L4 Nodes: {len(l4)}")

# AI Providers
print("\n[AI PROVIDERS]")
providers = sb_get("ai_providers?select=name,is_active,is_online&order=name")
online = sum(1 for p in providers if p.get('is_online'))
active = sum(1 for p in providers if p.get('is_active'))
print(f"  Total: {len(providers)} | Active: {active} | Online: {online}")
for p in providers:
    s = "ON " if p.get('is_online') else "OFF"
    print(f"    [{s}] {p['name']}")

# Platform Status
print("\n[PLATFORM STATUS]")
checks = [
    ("Azure Pipeline", "https://seobaike-l1l4-pipeline.azurewebsites.net/api/health"),
    ("Azure Router", "https://seobaike-ai-router.azurewebsites.net/api/health"),
    ("aiforseo.vip", "https://aiforseo.vip/"),
]
for name, url in checks:
    code = http_check(url)
    s = "OK" if 200 <= code < 500 else "FAIL"
    print(f"  [{s}] {name}: {code}")

# NVIDIA Quick Test
print("\n[NVIDIA NIM]")
payload = json.dumps({"model": "meta/llama-3.1-8b-instruct", "messages": [{"role": "user", "content": "Say OK"}], "max_tokens": 5}).encode()
req = urllib.request.Request("https://integrate.api.nvidia.com/v1/chat/completions", data=payload, headers={"Content-Type": "application/json", "Authorization": f"Bearer {NV_KEY}"})
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        r = json.loads(resp.read())
        print(f"  [OK] NIM Response: {r['choices'][0]['message']['content'][:30]}")
except Exception as e:
    print(f"  [FAIL] {e}")

# Azure Resources
print("\n[AZURE RESOURCES]")
print("  Resource Group: seobaike-rg (japaneast)")
print("  Key Vault: seobaike-vault")
print("  Pipeline: seobaike-l1l4-pipeline (eastasia)")
print("  Router: seobaike-ai-router (eastasia)")
print("  APIM: seobaike-apim (deploying)")
print("  Entra App: a5775f43-e106-4fa5-828c-d02c7e24a51a")

# Local Files
print("\n[LOCAL FILES]")
local_checks = [
    "azure/functions/l1-l4-pipeline/function_app.py",
    "azure/functions/ai-router/function_app.py",
    "azure/rules/authority-rules.json",
    "azure/entra-config/app-registration.json",
    "azure/apim-policies/ai-router-policy.xml",
    "azure/copilot-studio/bot-config.json",
    "workers/src/index.ts",
    "nvidia-test.py",
    "system-check.py",
]
for f in local_checks:
    full = os.path.join("C:\\SEOBAIKE", f)
    exists = os.path.exists(full)
    size = os.path.getsize(full) if exists else 0
    s = "OK" if exists else "MISSING"
    print(f"  [{s}] {f} ({size:,} bytes)")

print("\n" + "=" * 60)
print("  Owner: SEOBAIKE / Hsiao Chun-Hsiang / Patent 115100981")
print("=" * 60)
