import urllib.request, json
from datetime import datetime, timezone

import os
SR = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SR:
    # fallback: read from keyvault via az cli
    import subprocess
    SR = subprocess.check_output("az keyvault secret show --vault-name seobaike-vault --name supabase-service-key --query value -o tsv", shell=True).decode().strip()
    if not SR:
        raise RuntimeError("No service key found")
ROUTER = "https://seobaike-ai-router.azurewebsites.net/api/route"
SUPABASE = "https://vmyrivxxibqydccurxug.supabase.co/rest/v1"

SCRIPT = "你是 SEOBAIKE AI 軍團的一員。指揮官是許竣翔（CEO, 小路光有限公司）。用中文回報：「[你的模型名] 報到！就緒。服從專利115100981。等待指令。」只回這一句。"

units = ["llama-main", "llama-70b", "mistral", "mixtral", "gemma", "phi3", "qwen"]

results = []
print("=== SEOBAIKE AI 軍團點名 ===\n")

for unit in units:
    try:
        payload = json.dumps({"messages": [{"role": "user", "content": SCRIPT}], "provider": unit, "max_tokens": 100}).encode()
        req = urllib.request.Request(ROUTER, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            content = data.get("result", {}).get("content", "NO RESPONSE")
            model = data.get("result", {}).get("model", "unknown")
            provider = data.get("router", {}).get("provider_used", unit)
            print(f"[{unit}] {content[:80]}")
            results.append({
                "unit": unit,
                "model": model,
                "response": content[:200],
                "status": "reported",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    except Exception as e:
        print(f"[{unit}] ERROR: {e}")
        results.append({
            "unit": unit,
            "model": "error",
            "response": str(e)[:200],
            "status": "failed",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

# Write to Supabase ai_logs
print(f"\n=== 寫入 Supabase ai_logs ===")
headers = {"apikey": SR, "Authorization": f"Bearer {SR}", "Content-Type": "application/json", "Prefer": "return=representation"}

# Check ai_logs columns first
try:
    req = urllib.request.Request(f"{SUPABASE}/ai_logs?limit=1", headers={"apikey": SR, "Authorization": f"Bearer {SR}"})
    with urllib.request.urlopen(req, timeout=10) as r:
        sample = json.loads(r.read())
        if sample:
            print(f"ai_logs columns: {list(sample[0].keys())}")
        else:
            print("ai_logs: empty table")
except Exception as e:
    print(f"ai_logs check failed: {e}")

# Write each result as a log entry
for r in results:
    log = {
        "action": f"roll_call_{r['unit']}",
        "input": SCRIPT[:100],
        "output": r["response"][:500],
        "model": r["model"],
        "status": r["status"],
        "metadata": json.dumps({"unit": r["unit"], "patent": "115100981", "commander": "許竣翔", "type": "military_roll_call"})
    }
    try:
        req = urllib.request.Request(f"{SUPABASE}/ai_logs", data=json.dumps(log).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  {r['unit']} -> written to ai_logs")
    except Exception as e:
        err = e.read().decode() if hasattr(e, 'read') else str(e)
        print(f"  {r['unit']} -> ai_logs failed: {err[:100]}")
        # Try ai_execution_audit_log as fallback
        audit = {
            "action_type": "roll_call",
            "description": f"{r['unit']}: {r['response'][:200]}",
            "status": "completed" if r["status"] == "reported" else "failed",
            "metadata": json.dumps({"unit": r["unit"], "model": r["model"], "patent": "115100981"})
        }
        try:
            req2 = urllib.request.Request(f"{SUPABASE}/ai_execution_audit_log", data=json.dumps(audit).encode(), headers=headers, method="POST")
            with urllib.request.urlopen(req2, timeout=10) as resp2:
                print(f"  {r['unit']} -> written to ai_execution_audit_log instead")
        except Exception as e2:
            err2 = e2.read().decode() if hasattr(e2, 'read') else str(e2)
            print(f"  {r['unit']} -> fallback also failed: {err2[:100]}")

print(f"\n=== 點名完畢 — {len([r for r in results if r['status']=='reported'])}/{len(units)} 回報 ===")
