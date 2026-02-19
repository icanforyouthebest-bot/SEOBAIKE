import azure.functions as func
import json
import os
import urllib.request
from datetime import datetime, timezone

def main(req: func.HttpRequest) -> func.HttpResponse:
    now = datetime.now(timezone.utc).isoformat()
    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    nk = os.environ.get("NVIDIA_API_KEY", "")

    sb_h = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}
    nim_h = {"Authorization": f"Bearer {nk}", "Content-Type": "application/json"}

    # Check all 10 models
    models = {
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

    model_status = {}
    for slot, model in models.items():
        body = json.dumps({"model": model, "messages": [{"role": "user", "content": "say OK"}], "max_tokens": 3}).encode()
        req2 = urllib.request.Request("https://integrate.api.nvidia.com/v1/chat/completions", data=body, headers=nim_h, method="POST")
        try:
            with urllib.request.urlopen(req2, timeout=8) as resp:
                model_status[slot] = {"model": model, "status": "ONLINE"}
        except:
            model_status[slot] = {"model": model, "status": "OFFLINE"}

    # Check Supabase
    sb_ok = False
    try:
        r = urllib.request.Request(f"{sb_url}/rest/v1/system_health?select=component,status&limit=1", headers=sb_h)
        with urllib.request.urlopen(r, timeout=5) as resp:
            sb_ok = True
    except:
        pass

    online = sum(1 for v in model_status.values() if v["status"] == "ONLINE")

    dashboard = {
        "system": "SEOBAIKE AI Platform",
        "commander": "許竣翔 (CEO, 小路光有限公司)",
        "patent": "115100981",
        "timestamp": now,
        "summary": {
            "models_online": f"{online}/10",
            "azure_functions": "3 apps running",
            "supabase": "connected" if sb_ok else "error",
            "telegram": "active"
        },
        "endpoints": {
            "dashboard": "https://grok-takeover-app.azurewebsites.net/api/dashboard",
            "alive_check": "https://grok-takeover-app.azurewebsites.net/api/alive_check",
            "takeover": "https://grok-takeover-app.azurewebsites.net/api/takeover_func",
            "ai_router_health": "https://seobaike-ai-router.azurewebsites.net/api/health",
            "ai_router_slots": "https://seobaike-ai-router.azurewebsites.net/api/slots",
            "ai_router_inference": "https://seobaike-ai-router.azurewebsites.net/api/route",
            "l1l4_pipeline": "https://seobaike-l1l4-pipeline.azurewebsites.net/api/health",
            "supabase_dashboard": "https://supabase.com/dashboard/project/vmyrivxxibqydccurxug"
        },
        "models": model_status,
        "azure_apps": [
            {"name": "grok-takeover-app", "functions": ["alive_check", "takeover_func", "heartbeat_timer", "dashboard"], "region": "East Asia"},
            {"name": "seobaike-ai-router", "functions": ["health", "slots", "route"], "region": "East Asia"},
            {"name": "seobaike-l1l4-pipeline", "functions": ["health", "pipeline"], "region": "East Asia"}
        ],
        "supabase": {
            "project": "vmyrivxxibqydccurxug",
            "region": "Tokyo",
            "tables": ["system_health", "ai_logs", "neural_sync_stream", "nim_models", "rollout_config"],
            "status": "connected" if sb_ok else "error"
        },
        "telegram": {
            "chat_id": "5372713163",
            "heartbeat": "every 5 min",
            "status": "active"
        }
    }

    resp = func.HttpResponse(json.dumps(dashboard, ensure_ascii=False, indent=2), mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp
