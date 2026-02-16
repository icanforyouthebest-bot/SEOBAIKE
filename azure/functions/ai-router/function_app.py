"""
SEOBAIKE AI Router — Azure Functions
模型全部降級為「推論引擎」，不再擁有主控權
所有模型 = USB 插槽，隨插隨拔

流程：L1→L4 Pipeline → AI Router → 選擇模型 → 呼叫 → 回傳
"""
import azure.functions as func
import json
import logging
import os
import httpx
from datetime import datetime, timezone

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

# === 模型 USB 插槽（隨插隨拔） ===
MODEL_SLOTS = {
    "nvidia": {
        "name": "NVIDIA NIM",
        "url": "https://integrate.api.nvidia.com/v1/chat/completions",
        "key_env": "NVIDIA_API_KEY",
        "model": "meta/llama-3.1-8b-instruct",
        "active": True
    },
    "groq": {
        "name": "Groq",
        "url": "https://api.groq.com/openai/v1/chat/completions",
        "key_env": "GROQ_API_KEY",
        "model": "llama-3.1-8b-instant",
        "active": True
    },
    "anthropic": {
        "name": "Anthropic Claude",
        "url": "https://api.anthropic.com/v1/messages",
        "key_env": "ANTHROPIC_API_KEY",
        "model": "claude-sonnet-4-5-20250929",
        "active": True,
        "format": "anthropic"
    },
    "mistral": {
        "name": "Mistral",
        "url": "https://api.mistral.ai/v1/chat/completions",
        "key_env": "MISTRAL_API_KEY",
        "model": "mistral-small-latest",
        "active": True
    },
    "together": {
        "name": "Together AI",
        "url": "https://api.together.xyz/v1/chat/completions",
        "key_env": "TOGETHER_API_KEY",
        "model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        "active": True
    },
    "fireworks": {
        "name": "Fireworks AI",
        "url": "https://api.fireworks.ai/inference/v1/chat/completions",
        "key_env": "FIREWORKS_API_KEY",
        "model": "accounts/fireworks/models/llama-v3p1-8b-instruct",
        "active": True
    },
    "xai": {
        "name": "xAI Grok",
        "url": "https://api.x.ai/v1/chat/completions",
        "key_env": "GROK_API_KEY",
        "model": "grok-2",
        "active": True
    },
    "openrouter": {
        "name": "OpenRouter",
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "key_env": "OPENROUTER_API_KEY",
        "model": "meta-llama/llama-3.1-8b-instruct",
        "active": True
    },
    "google": {
        "name": "Google Gemini",
        "url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "key_env": "GOOGLE_AI_KEY",
        "model": "gemini-2.0-flash",
        "active": True
    },
    "cohere": {
        "name": "Cohere",
        "url": "https://api.cohere.com/v2/chat",
        "key_env": "COHERE_API_KEY",
        "model": "command-a-03-2025",
        "active": True,
        "format": "cohere"
    },
    "ai21": {
        "name": "AI21 Labs",
        "url": "https://api.ai21.com/studio/v1/chat/completions",
        "key_env": "AI21_API_KEY",
        "model": "jamba-large",
        "active": True
    }
}

# === 自動選擇最佳模型 ===
def select_provider(preferred: str = "auto") -> dict:
    """USB 插槽選擇：指定供應商或自動選最佳"""
    if preferred != "auto" and preferred in MODEL_SLOTS:
        slot = MODEL_SLOTS[preferred]
        if slot["active"] and os.environ.get(slot["key_env"]):
            return {**slot, "provider_id": preferred}

    # 自動選擇：按優先順序
    priority = ["nvidia", "groq", "together", "fireworks", "mistral", "xai", "openrouter", "google", "ai21", "cohere"]
    for pid in priority:
        slot = MODEL_SLOTS.get(pid, {})
        if slot.get("active") and os.environ.get(slot.get("key_env", "")):
            return {**slot, "provider_id": pid}

    return None


# === 呼叫推論引擎（模型無主控權） ===
async def call_inference_engine(provider: dict, messages: list, max_tokens: int = 1000) -> dict:
    """
    模型 = 推論引擎，只負責回答
    無權存取系統、無權修改資料、無權做決策
    """
    api_key = os.environ.get(provider["key_env"], "")
    fmt = provider.get("format", "openai")

    headers = {"Content-Type": "application/json"}

    if fmt == "anthropic":
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
        body = {
            "model": provider["model"],
            "messages": messages,
            "max_tokens": max_tokens
        }
    elif fmt == "cohere":
        headers["Authorization"] = f"Bearer {api_key}"
        body = {
            "model": provider["model"],
            "messages": messages,
            "max_tokens": max_tokens
        }
    else:
        headers["Authorization"] = f"Bearer {api_key}"
        body = {
            "model": provider["model"],
            "messages": messages,
            "max_tokens": max_tokens
        }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(provider["url"], json=body, headers=headers)
        result = resp.json()

        if resp.status_code == 200:
            # 標準化輸出（不管模型怎麼回，統一格式）
            if fmt == "anthropic":
                content = result.get("content", [{}])[0].get("text", "")
            elif "choices" in result:
                content = result["choices"][0].get("message", {}).get("content", "")
            else:
                content = str(result)

            return {
                "status": "ok",
                "content": content,
                "provider": provider["provider_id"],
                "model": provider["model"],
                "tokens_used": result.get("usage", {})
            }
        else:
            return {
                "status": "error",
                "code": resp.status_code,
                "detail": result.get("error", {}).get("message", str(result)[:100]),
                "provider": provider["provider_id"]
            }


# === 主入口 ===
@app.route(route="route", methods=["POST"])
async def ai_route(req: func.HttpRequest) -> func.HttpResponse:
    """
    AI Router：接收已驗證的推論請求，選擇引擎，呼叫，回傳
    模型沒有主控權，只是工具
    """
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON"}),
            status_code=400,
            mimetype="application/json"
        )

    messages = body.get("messages", [])
    provider_pref = body.get("provider", "auto")
    max_tokens = body.get("max_tokens", 1000)
    path_check = body.get("path_check", {})

    if not messages:
        return func.HttpResponse(
            json.dumps({"error": "messages required"}),
            status_code=400,
            mimetype="application/json"
        )

    # 選擇推論引擎
    provider = select_provider(provider_pref)
    if not provider:
        return func.HttpResponse(
            json.dumps({"error": "no available inference engine"}),
            status_code=503,
            mimetype="application/json"
        )

    # 呼叫推論引擎
    result = await call_inference_engine(provider, messages, max_tokens)

    # 封裝回傳（微軟層最後處理）
    return func.HttpResponse(
        json.dumps({
            **result,
            "pipeline": {
                "path_check": path_check.get("status", "bypass"),
                "routed_by": "azure-ai-router",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }),
        mimetype="application/json"
    )


# === 插槽狀態 ===
@app.route(route="slots", methods=["GET"])
async def list_slots(req: func.HttpRequest) -> func.HttpResponse:
    """列出所有模型 USB 插槽狀態"""
    slots = []
    for pid, slot in MODEL_SLOTS.items():
        has_key = bool(os.environ.get(slot["key_env"]))
        slots.append({
            "id": pid,
            "name": slot["name"],
            "model": slot["model"],
            "active": slot["active"],
            "has_key": has_key,
            "usable": slot["active"] and has_key
        })

    usable = sum(1 for s in slots if s["usable"])

    return func.HttpResponse(
        json.dumps({
            "total": len(slots),
            "usable": usable,
            "slots": slots
        }),
        mimetype="application/json"
    )
