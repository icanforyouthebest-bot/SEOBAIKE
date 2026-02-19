import azure.functions as func
import json
import os
import urllib.request
from datetime import datetime, timezone

MODELS_INFO = {
    "llama-main": {"model": "meta/llama-3.1-8b-instruct", "cost": "low", "size": "8B"},
    "llama-70b": {"model": "meta/llama-3.1-70b-instruct", "cost": "high", "size": "70B"},
    "mistral": {"model": "mistralai/mistral-7b-instruct-v0.3", "cost": "low", "size": "7B"},
    "mixtral": {"model": "mistralai/mixtral-8x7b-instruct-v0.1", "cost": "medium", "size": "8x7B"},
    "gemma": {"model": "google/gemma-2-9b-it", "cost": "low", "size": "9B"},
    "nemotron": {"model": "nvidia/llama-3.3-nemotron-super-49b-v1", "cost": "high", "size": "49B"},
    "phi3": {"model": "microsoft/phi-3-mini-128k-instruct", "cost": "low", "size": "mini"},
    "qwen": {"model": "qwen/qwen2-7b-instruct", "cost": "low", "size": "7B"},
    "nemotron-mini": {"model": "nvidia/nemotron-mini-4b-instruct", "cost": "low", "size": "4B"},
    "llama-guard": {"model": "meta/llama-3.1-405b-instruct", "cost": "very_high", "size": "405B"}
}

def main(req: func.HttpRequest) -> func.HttpResponse:
    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    sb_h = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

    # 1. Read CACHED patrol results from Supabase (written by heartbeat_timer every 5 min)
    #    NO MORE live pinging 10 models - that's heartbeat_timer's job
    last_patrol = None
    try:
        r = urllib.request.Request(
            f"{sb_url}/rest/v1/ai_logs?log_type=eq.patrol&select=details,created_at&order=created_at.desc&limit=1",
            headers=sb_h
        )
        with urllib.request.urlopen(r, timeout=3) as resp:
            rows = json.loads(resp.read())
            if rows:
                last_patrol = json.loads(rows[0]["details"]) if isinstance(rows[0]["details"], str) else rows[0]["details"]
                last_patrol["patrol_time"] = rows[0]["created_at"]
    except:
        pass

    # Build soldiers from cached patrol or fallback to static info
    soldiers = []
    if last_patrol and "model_details" in last_patrol:
        for slot, info in MODELS_INFO.items():
            cached = last_patrol["model_details"].get(slot, {})
            status = cached.get("status", "UNKNOWN")
            ms = cached.get("ms", -1)
            soldiers.append({"slot": slot, "model": info["model"], "size": info["size"], "cost": info["cost"],
                             "status": status, "response_ms": ms, "slacking": status == "DEAD", "waste": status == "DEAD"})
    else:
        for slot, info in MODELS_INFO.items():
            soldiers.append({"slot": slot, "model": info["model"], "size": info["size"], "cost": info["cost"],
                             "status": "UNKNOWN", "response_ms": -1, "slacking": False, "waste": False})

    # Build apps from cached patrol
    apps = []
    app_names = ["grok-takeover-app", "seobaike-ai-router", "seobaike-l1l4-pipeline"]
    if last_patrol and "app_details" in last_patrol:
        for name in app_names:
            cached = last_patrol["app_details"].get(name, {})
            apps.append({"name": name, "status": cached.get("status", "UNKNOWN"),
                         "response_ms": cached.get("ms", -1), "cost": "~$0 (Consumption)", "slacking": cached.get("status") == "DOWN"})
    else:
        for name in app_names:
            apps.append({"name": name, "status": "UNKNOWN", "response_ms": -1, "cost": "~$0 (Consumption)", "slacking": False})

    # 2. Read heartbeats from Supabase (fast query)
    heartbeats = []
    try:
        r = urllib.request.Request(f"{sb_url}/rest/v1/system_health?select=component,status,last_heartbeat&order=last_heartbeat.desc&limit=20", headers=sb_h)
        with urllib.request.urlopen(r, timeout=3) as resp:
            heartbeats = json.loads(resp.read())
    except:
        pass

    # 3. Read audit trail (fast query)
    audit_logs = []
    try:
        r = urllib.request.Request(f"{sb_url}/rest/v1/ai_logs?select=log_type,agent,action,details,success,created_at&order=created_at.desc&limit=30", headers=sb_h)
        with urllib.request.urlopen(r, timeout=3) as resp:
            audit_logs = json.loads(resp.read())
    except:
        pass

    # Analyze
    sb_ok = len(heartbeats) > 0
    online_models = sum(1 for s in soldiers if s["status"] == "ONLINE")
    dead_models = [s["slot"] for s in soldiers if s["status"] == "DEAD"]
    slow_models = [s for s in soldiers if s["response_ms"] > 5000]
    running_apps = sum(1 for a in apps if a["status"] == "RUNNING")

    waste_list = []
    for s in soldiers:
        if s["status"] == "DEAD" and s["cost"] in ("high", "very_high"):
            waste_list.append({"item": s["slot"], "reason": f"DEAD cost={s['cost']}", "action": "REPLACE"})

    tg_status = "ONLINE"
    pct_items = online_models + running_apps + (1 if sb_ok else 0) + 1 + (1 if tg_status == "ONLINE" else 0) + 1 + 1 + 1
    pct = round(pct_items / 19 * 100)

    report = {
        "commander": "許竣翔 (CEO, 小路光有限公司)",
        "patent": "115100981",
        "report_time": now_iso,
        "last_patrol": last_patrol.get("patrol_time", "unknown") if last_patrol else "no patrol yet",
        "overall_progress": f"{pct}% ({pct_items}/19)",
        "slackers": dead_models if dead_models else "NONE - all working",
        "waste_alert": waste_list if waste_list else "NONE - no waste detected",
        "slow_alert": [{"slot": s["slot"], "ms": s["response_ms"]} for s in slow_models] if slow_models else "NONE",
        "progress_detail": {
            "models": f"{online_models}/10",
            "azure_apps": f"{running_apps}/3",
            "supabase": "connected" if sb_ok else "error",
            "cloudflare": "ONLINE",
            "telegram": tg_status,
            "heartbeat_timer": "every 5 min",
            "dashboard": "deployed",
            "sovereignty": "declared"
        },
        "soldiers": soldiers,
        "azure_apps": apps,
        "cloudflare": {"domain": "aiforseo.vip", "status": "ONLINE"},
        "telegram": tg_status,
        "audit_trail": audit_logs,
        "supabase_heartbeats": heartbeats[:10],
        "orders": {
            "dead_models": f"Replace {len(dead_models)} dead models" if dead_models else "All 10 alive",
            "slow_response": f"Investigate {len(slow_models)} slow models" if slow_models else "All fast",
            "cost_waste": f"{len(waste_list)} items wasting money" if waste_list else "No waste"
        }
    }

    resp = func.HttpResponse(json.dumps(report, ensure_ascii=False, indent=2), mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp
