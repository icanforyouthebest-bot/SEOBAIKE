import azure.functions as func
import json
import os
import urllib.request
from datetime import datetime, timezone

NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

MODELS = {
    "llama-main": "meta/llama-3.1-8b-instruct",
    "llama-70b": "meta/llama-3.1-70b-instruct",
    "mistral": "mistralai/mistral-7b-instruct-v0.3",
    "mixtral": "mistralai/mixtral-8x7b-instruct-v0.1",
    "gemma": "google/gemma-2-9b-it",
    "nemotron": "nvidia/llama-3.3-nemotron-super-49b-v1",
    "phi3": "microsoft/phi-3-mini-128k-instruct",
    "qwen": "qwen/qwen2-7b-instruct",
    "nemotron-mini": "nvidia/nemotron-mini-4b-instruct",
    "llama-guard": "meta/llama-3.1-405b-instruct"
}

# Backup models - if primary dies, try these in order
BACKUPS = {
    "llama-main": ["meta/llama-3.1-70b-instruct", "meta/llama-3.1-405b-instruct"],
    "llama-70b": ["meta/llama-3.1-405b-instruct", "meta/llama-3.1-8b-instruct"],
    "mistral": ["mistralai/mixtral-8x7b-instruct-v0.1", "mistralai/mistral-7b-instruct-v0.3"],
    "mixtral": ["mistralai/mistral-7b-instruct-v0.3", "google/gemma-2-9b-it"],
    "gemma": ["google/gemma-2-27b-it", "qwen/qwen2-7b-instruct"],
    "nemotron": ["nvidia/nemotron-mini-4b-instruct", "meta/llama-3.1-70b-instruct"],
    "phi3": ["microsoft/phi-3-small-128k-instruct", "microsoft/phi-3-medium-128k-instruct"],
    "qwen": ["qwen/qwen2-72b-instruct", "meta/llama-3.1-8b-instruct"],
    "nemotron-mini": ["nvidia/llama-3.3-nemotron-super-49b-v1", "meta/llama-3.1-8b-instruct"],
    "llama-guard": ["meta/llama-3.1-70b-instruct", "meta/llama-3.1-8b-instruct"]
}

APPS = [
    {"name": "grok-takeover-app", "url": "https://grok-takeover-app.azurewebsites.net/api/alive_check"},
    {"name": "seobaike-ai-router", "url": "https://seobaike-ai-router.azurewebsites.net/api/health"},
    {"name": "seobaike-l1l4-pipeline", "url": "https://seobaike-l1l4-pipeline.azurewebsites.net/api/health"}
]


def send_telegram(message):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return
    data = json.dumps({"chat_id": chat_id, "text": message, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


def check_model(model_id, nim_headers):
    body = json.dumps({"model": model_id, "messages": [{"role": "user", "content": "say OK"}], "max_tokens": 3}).encode()
    req = urllib.request.Request(NIM_URL, data=body, headers=nim_headers, method="POST")
    try:
        t0 = datetime.now(timezone.utc)
        with urllib.request.urlopen(req, timeout=12) as resp:
            ms = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
            return {"status": "ONLINE", "ms": ms}
    except Exception as e:
        return {"status": "DEAD", "ms": -1, "error": str(e)[:80]}


def check_app(url):
    try:
        t0 = datetime.now(timezone.utc)
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            ms = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
            return {"status": "RUNNING", "ms": ms}
    except Exception as e:
        return {"status": "DOWN", "ms": -1, "error": str(e)[:80]}


def check_supabase(sb_url, sb_headers):
    try:
        req = urllib.request.Request(
            f"{sb_url}/rest/v1/system_health?select=component&limit=1",
            headers=sb_headers
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return True
    except Exception:
        return False


def write_audit_log(sb_url, sb_headers, log_type, agent, action, details, now_iso):
    """Write traceable audit log to ai_logs - permanent record, cannot be faked"""
    try:
        log_headers = {**sb_headers, "Content-Type": "application/json"}
        log_data = json.dumps({
            "log_type": log_type,
            "agent": agent,
            "action": action,
            "details": json.dumps(details, ensure_ascii=False),
            "success": True,
            "created_at": now_iso
        }).encode()
        req = urllib.request.Request(
            f"{sb_url}/rest/v1/ai_logs",
            data=log_data, headers=log_headers, method="POST"
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


def write_heartbeat(sb_url, sb_headers, now_iso, report):
    payload = {
        "component": "GROK4.1",
        "status": "healthy",
        "last_heartbeat": now_iso,
        "metadata": json.dumps(report)
    }
    headers = {**sb_headers, "Content-Type": "application/json", "Prefer": "return=representation"}
    # PATCH first
    try:
        req = urllib.request.Request(
            f"{sb_url}/rest/v1/system_health?component=eq.GROK4.1",
            data=json.dumps({"status": "healthy", "last_heartbeat": now_iso, "metadata": json.dumps(report)}).encode(),
            headers=headers, method="PATCH"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if not result:
                req2 = urllib.request.Request(
                    f"{sb_url}/rest/v1/system_health",
                    data=json.dumps(payload).encode(),
                    headers=headers, method="POST"
                )
                urllib.request.urlopen(req2, timeout=10)
    except Exception:
        pass


def main(mytimer: func.TimerRequest) -> None:
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    nk = os.environ.get("NVIDIA_API_KEY", "")

    sb_headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}
    nim_headers = {"Authorization": f"Bearer {nk}", "Content-Type": "application/json"}

    # === 1. CHECK ALL 10 MODELS ===
    model_results = {}
    dead_models = []
    slow_models = []
    for slot, model_id in MODELS.items():
        result = check_model(model_id, nim_headers)
        model_results[slot] = result
        if result["status"] == "DEAD":
            dead_models.append(slot)
        elif result["ms"] > 5000:
            slow_models.append({"slot": slot, "ms": result["ms"]})

    online_count = sum(1 for r in model_results.values() if r["status"] == "ONLINE")

    # === 2. CHECK ALL 3 AZURE APPS ===
    app_results = {}
    dead_apps = []
    for app in APPS:
        result = check_app(app["url"])
        app_results[app["name"]] = result
        if result["status"] == "DOWN":
            dead_apps.append(app["name"])

    running_apps = sum(1 for r in app_results.values() if r["status"] == "RUNNING")

    # === 3. CHECK SUPABASE ===
    sb_ok = check_supabase(sb_url, sb_headers)

    # === 4. BUILD REPORT ===
    problems = []
    if dead_models:
        problems.append(f"DEAD MODELS: {', '.join(dead_models)}")
    if dead_apps:
        problems.append(f"DEAD APPS: {', '.join(dead_apps)}")
    if not sb_ok:
        problems.append("SUPABASE DOWN")
    if slow_models:
        problems.append(f"SLOW: {', '.join(s['slot']+':'+str(s['ms'])+'ms' for s in slow_models)}")

    has_problems = len(problems) > 0

    report = {
        "timestamp": now_iso,
        "models_online": f"{online_count}/10",
        "apps_running": f"{running_apps}/3",
        "supabase": "connected" if sb_ok else "error",
        "problems": problems if problems else "NONE",
        "auto_heal": True
    }

    # === 5. WRITE TO SUPABASE ===
    write_heartbeat(sb_url, sb_headers, now_iso, report)

    # === 5.1 AUDIT LOG - PATROL REPORT (TRACEABLE) ===
    write_audit_log(sb_url, sb_headers, "patrol", "physical_ai_patrol", "system_check", {
        "models_online": online_count,
        "models_total": 10,
        "apps_running": running_apps,
        "apps_total": 3,
        "supabase": "connected" if sb_ok else "error",
        "dead_models": dead_models,
        "slow_models": [{"slot": s["slot"], "ms": s["ms"]} for s in slow_models],
        "dead_apps": dead_apps,
        "problems_count": len(problems),
        "model_details": {k: {"status": v["status"], "ms": v["ms"]} for k, v in model_results.items()},
        "app_details": {k: {"status": v["status"], "ms": v["ms"]} for k, v in app_results.items()}
    }, now_iso)

    # === 6. SEND TELEGRAM ===
    if has_problems:
        # ALERT - something is wrong
        lines = [
            "<b>SEOBAIKE ALERT</b>",
            f"Time: {now_iso}",
            "",
            f"Models: {online_count}/10",
            f"Apps: {running_apps}/3",
            f"Supabase: {'OK' if sb_ok else 'ERROR'}",
            ""
        ]
        for p in problems:
            lines.append(f"X {p}")
        lines.append("")
        lines.append("System is attempting auto-recovery...")
        send_telegram("\n".join(lines))
    else:
        # ALL CLEAR - normal heartbeat
        lines = [
            "<b>SEOBAIKE Physical AI</b>",
            f"{now_iso}",
            "",
            f"Models: {online_count}/10 ONLINE",
            f"Apps: {running_apps}/3 RUNNING",
            f"Supabase: OK",
            f"L1-L4: ACTIVE",
            "",
            "All clear. Zero problems.",
            "Patent 115100981"
        ]
        send_telegram("\n".join(lines))

    # === 7. AUTO-HEAL: TRY BACKUP MODELS ===
    swapped = []
    if dead_models:
        for slot in dead_models:
            backups = BACKUPS.get(slot, [])
            for backup_model in backups:
                result = check_model(backup_model, nim_headers)
                if result["status"] == "ONLINE":
                    # Found working backup - write to Supabase nim_models
                    old_model = MODELS[slot]
                    MODELS[slot] = backup_model
                    swapped.append({"slot": slot, "old": old_model, "new": backup_model, "ms": result["ms"]})
                    # Update nim_models table
                    try:
                        swap_headers = {**sb_headers, "Content-Type": "application/json", "Prefer": "return=representation"}
                        swap_data = json.dumps({
                            "slot_name": slot,
                            "model_id": backup_model,
                            "status": "active",
                            "last_check": now_iso,
                            "metadata": json.dumps({"auto_swapped": True, "old_model": old_model, "reason": "primary_dead", "swapped_at": now_iso})
                        }).encode()
                        # Try PATCH first
                        req = urllib.request.Request(
                            f"{sb_url}/rest/v1/nim_models?slot_name=eq.{slot}",
                            data=swap_data, headers=swap_headers, method="PATCH"
                        )
                        with urllib.request.urlopen(req, timeout=5) as resp:
                            r = json.loads(resp.read())
                            if not r:
                                req2 = urllib.request.Request(
                                    f"{sb_url}/rest/v1/nim_models",
                                    data=swap_data, headers=swap_headers, method="POST"
                                )
                                urllib.request.urlopen(req2, timeout=5)
                    except Exception:
                        pass
                    # Log to system_health
                    try:
                        heal_headers = {**sb_headers, "Content-Type": "application/json", "Prefer": "return=representation"}
                        heal_data = json.dumps({
                            "component": f"auto_swap_{slot}",
                            "status": "healed",
                            "last_heartbeat": now_iso,
                            "metadata": json.dumps({"old": old_model, "new": backup_model, "ms": result["ms"]})
                        }).encode()
                        req = urllib.request.Request(
                            f"{sb_url}/rest/v1/system_health",
                            data=heal_data, headers=heal_headers, method="POST"
                        )
                        urllib.request.urlopen(req, timeout=5)
                    except Exception:
                        pass
                    break  # Found working backup, stop trying

    # Send swap notification + AUDIT LOG
    if swapped:
        lines = ["<b>AUTO-HEAL COMPLETE</b>", f"{now_iso}", ""]
        for s in swapped:
            lines.append(f"Slot: {s['slot']}")
            lines.append(f"  OLD: {s['old']} (DEAD)")
            lines.append(f"  NEW: {s['new']} (ONLINE {s['ms']}ms)")
            lines.append("")
            # Audit log for each swap - traceable
            write_audit_log(sb_url, sb_headers, "auto_heal", "physical_ai_heal", "model_swap", {
                "slot": s["slot"],
                "old_model": s["old"],
                "new_model": s["new"],
                "new_model_ms": s["ms"],
                "reason": "primary_model_dead",
                "result": "swap_success",
                "autonomous": True
            }, now_iso)
        lines.append("Physical AI auto-recovery successful.")
        lines.append("Patent 115100981")
        send_telegram("\n".join(lines))

    print(f"[{now_iso}] Patrol: {online_count}/10 models, {running_apps}/3 apps, swapped={len(swapped)}, problems={len(problems)}")
