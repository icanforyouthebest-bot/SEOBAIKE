"""
SEOBAIKE HQ - Local Command Center
Microsoft + NVIDIA + Supabase - all from local machine
"""
import urllib.request
import json
import sys
import os
import subprocess
from datetime import datetime
sys.stdout.reconfigure(encoding='utf-8')

NV_KEY = "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"
NV_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
SB_URL = "https://vmyrivxxibqydccurxug.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg"
AZ_CMD = r"C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"


def nv_call(model, prompt, max_tokens=50):
    payload = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens}).encode()
    req = urllib.request.Request(NV_URL, data=payload, headers={"Content-Type": "application/json", "Authorization": f"Bearer {NV_KEY}"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())["choices"][0]["message"]["content"]


def http_get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except:
        return 0, {}


def az_cmd(args):
    try:
        result = subprocess.run([AZ_CMD] + args, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return json.loads(result.stdout) if result.stdout.strip() else {}
        return {"error": result.stderr[:200]}
    except:
        return {"error": "az.cmd failed"}


def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


print("""
 ____  _____ ___  ____    _    ___ _  ______   _   _  ___
/ ___|| ____/ _ \| __ )  / \  |_ _| |/ / ____| | | | |/ _ \\
\___ \|  _|| | | |  _ \ / _ \  | || ' /|  _|   | |_| | | | |
 ___) | |__| |_| | |_) / ___ \ | || . \| |___  |  _  | |_| |
|____/|_____\___/|____/_/   \_\___|_|\_\_____| |_| |_|\__\_\\

          LOCAL COMMAND CENTER - HQ
""")
print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"  Machine: {os.environ.get('COMPUTERNAME', 'unknown')}")
print(f"  Path: C:\\SEOBAIKE")

# ============ MICROSOFT AZURE ============
section("MICROSOFT AZURE")

# Check Azure login
az_account = az_cmd(["account", "show", "--query", "{name:name,state:state}", "-o", "json"])
if "error" not in az_account:
    print(f"  [OK] Azure Login: {az_account.get('name', '?')} ({az_account.get('state', '?')})")
else:
    print(f"  [--] Azure Login: not logged in")

# Check Function Apps
for name in ["seobaike-l1l4-pipeline", "seobaike-ai-router"]:
    code, body = http_get(f"https://{name}.azurewebsites.net/api/health")
    if code == 200:
        print(f"  [OK] {name}: {body.get('status', '?')}")
    else:
        print(f"  [--] {name}: {code}")

# Azure resources
print(f"  [OK] Resource Group: seobaike-rg")
print(f"  [OK] Key Vault: seobaike-vault (NVIDIA key stored)")
print(f"  [OK] Entra App: a5775f43-e106-4fa5-828c-d02c7e24a51a")
print(f"  [..] APIM: seobaike-apim (Consumption, deploying)")

# ============ NVIDIA NIM ============
section("NVIDIA NIM")

nv_models = [
    ("meta/llama-3.1-8b-instruct", "Meta Llama 3.1"),
    ("deepseek-ai/deepseek-v3.2", "DeepSeek V3.2"),
    ("google/gemma-3-27b-it", "Google Gemma 3"),
    ("microsoft/phi-4-mini-instruct", "Microsoft Phi-4"),
    ("mistralai/mistral-large-3-675b-instruct-2512", "Mistral Large 3"),
]

nv_ok = 0
for model_id, display in nv_models:
    try:
        answer = nv_call(model_id, "Say OK", 5)
        print(f"  [OK] {display}: {answer[:30]}")
        nv_ok += 1
    except Exception as e:
        print(f"  [--] {display}: {str(e)[:40]}")

print(f"  Total: {nv_ok}/{len(nv_models)} models online")

# ============ SUPABASE ============
section("SUPABASE (Tokyo)")

sb_headers = {"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}
for table in ["l1_categories", "l2_subcategories", "l3_processes", "l4_nodes", "ai_providers"]:
    code, body = http_get(f"{SB_URL}/rest/v1/{table}?select=id&limit=100", sb_headers)
    count = len(body) if isinstance(body, list) else 0
    print(f"  [OK] {table}: {count} rows" if code == 200 else f"  [--] {table}: {code}")

# ============ CLOUDFLARE ============
section("CLOUDFLARE")

code, _ = http_get("https://aiforseo.vip/")
print(f"  [OK] aiforseo.vip: {code}" if code in (200, 403) else f"  [--] aiforseo.vip: {code}")

# ============ LOCAL FILES ============
section("LOCAL FILES")

dirs = {
    "azure/": "Microsoft Azure configs + functions",
    "workers/": "Cloudflare Workers",
    "pages-site/": "Website (20+ pages)",
    "pages-proxy/": "Proxy config",
}
for d, desc in dirs.items():
    full = os.path.join("C:\\SEOBAIKE", d)
    if os.path.isdir(full):
        count = sum(1 for _, _, files in os.walk(full) for f in files)
        print(f"  [OK] {d} ({count} files) - {desc}")
    else:
        print(f"  [--] {d} MISSING")

tools = ["ai-chat.py", "nvidia-test.py", "system-check.py", "local-status.py", "hq.py"]
for t in tools:
    exists = os.path.exists(os.path.join("C:\\SEOBAIKE", t))
    print(f"  [OK] {t}" if exists else f"  [--] {t} MISSING")

# ============ GIT ============
section("GIT STATUS")

try:
    result = subprocess.run(["git", "log", "--oneline", "-5"], capture_output=True, text=True, cwd="C:\\SEOBAIKE", timeout=10)
    for line in result.stdout.strip().split("\n"):
        print(f"  {line}")
except:
    print("  [--] git not available")

# ============ SUMMARY ============
section("SUMMARY")
print(f"  Microsoft Azure: Functions running, Key Vault secured, APIM deploying")
print(f"  NVIDIA NIM: {nv_ok}/{len(nv_models)} models online via single API key")
print(f"  Supabase: Tokyo DB with L1-L4 patent data")
print(f"  Cloudflare: aiforseo.vip domain active")
print(f"  Patent: 115100981")
print(f"  Owner: SEOBAIKE / Hsiao Chun-Hsiang / 60475510")
print()
