"""
SEOBAIKE AI Router — Azure Functions
模型 = USB 插槽，隨插隨拔。NVIDIA NIM 為主力。
"""
import azure.functions as func
import json
import logging
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

NVIDIA_KEY = os.environ.get("NVIDIA_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

MODEL_SLOTS = {
    "llama-main": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "meta/llama-3.1-8b-instruct", "active": True},
    "llama-70b": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "meta/llama-3.1-70b-instruct", "active": True},
    "mistral": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "mistralai/mistral-7b-instruct-v0.3", "active": True},
    "mixtral": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "mistralai/mixtral-8x7b-instruct-v0.1", "active": True},
    "gemma": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "google/gemma-2-9b-it", "active": True},
    "nemotron": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "nvidia/llama-3.3-nemotron-super-49b-v1", "active": True},
    "phi3": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "microsoft/phi-3-mini-128k-instruct", "active": True},
    "qwen": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "qwen/qwen2-7b-instruct", "active": True},
    "nemotron-mini": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "nvidia/nemotron-mini-4b-instruct", "active": True},
    "llama-guard": {"url": NIM_URL, "key_env": "NVIDIA_API_KEY", "model": "meta/llama-3.1-405b-instruct", "active": True},
}


def call_model(provider, messages, model=None, max_tokens=1000):
    slot = MODEL_SLOTS.get(provider)
    if not slot or not slot["active"]:
        return {"error": f"Provider '{provider}' not available"}

    api_key = os.environ.get(slot["key_env"], "")
    if not api_key:
        return {"error": f"No API key for '{provider}'"}

    use_model = model or slot["model"]
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    payload = {"model": use_model, "messages": messages, "max_tokens": max_tokens}

    req = urllib.request.Request(slot["url"], data=json.dumps(payload).encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            content = ""
            if "choices" in result:
                content = result["choices"][0].get("message", {}).get("content", "")
            elif "content" in result:
                content = result["content"][0].get("text", "") if isinstance(result["content"], list) else str(result["content"])
            return {"provider": provider, "model": use_model, "content": content, "raw_keys": list(result.keys())}
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        return {"error": f"{e.code} {body}", "provider": provider}
    except Exception as e:
        return {"error": str(e), "provider": provider}


def select_provider(preferred="auto"):
    if preferred != "auto" and preferred in MODEL_SLOTS:
        key = os.environ.get(MODEL_SLOTS[preferred]["key_env"], "")
        if key and MODEL_SLOTS[preferred]["active"]:
            return preferred
    for name, slot in MODEL_SLOTS.items():
        if slot["active"] and os.environ.get(slot["key_env"], ""):
            return name
    return "nvidia"


@app.route(route="route", methods=["POST"])
def route_inference(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(json.dumps({"error": "Invalid JSON"}), status_code=400, mimetype="application/json")

    messages = body.get("messages", [])
    provider = select_provider(body.get("provider", "auto"))
    model = body.get("model") if body.get("model") != "auto" else None
    max_tokens = body.get("max_tokens", 1000)

    result = call_model(provider, messages, model, max_tokens)

    return func.HttpResponse(json.dumps({
        "result": result,
        "router": {"provider_used": provider, "timestamp": datetime.now(timezone.utc).isoformat(), "owner": "SEOBAIKE"}
    }), mimetype="application/json")


@app.route(route="slots", methods=["GET"])
def list_slots(req: func.HttpRequest) -> func.HttpResponse:
    slots = {}
    for name, slot in MODEL_SLOTS.items():
        has_key = bool(os.environ.get(slot["key_env"], ""))
        slots[name] = {"model": slot["model"], "active": slot["active"], "has_key": has_key, "status": "online" if has_key and slot["active"] else "offline"}
    return func.HttpResponse(json.dumps({"slots": slots, "timestamp": datetime.now(timezone.utc).isoformat()}), mimetype="application/json")


@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(json.dumps({"status": "healthy", "service": "ai-router", "owner": "SEOBAIKE", "timestamp": datetime.now(timezone.utc).isoformat()}), mimetype="application/json")
