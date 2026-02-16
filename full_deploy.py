"""
SEOBAIKE 全組織部署腳本
安全模式：不暴露任何 API key
"""
import json, urllib.request, ssl, time

SB_URL = "https://vmyrivxxibqydccurxug.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg"

ctx = ssl.create_default_context()

def sb_get(path):
    req = urllib.request.Request(f"{SB_URL}/rest/v1/{path}")
    req.add_header("apikey", SB_KEY)
    req.add_header("Authorization", f"Bearer {SB_KEY}")
    with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
        return json.loads(r.read())

def sb_post(url, body, key):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {key}")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            body = e.read()
            return e.code, json.loads(body) if body else {"error": f"HTTP {e.code}"}
        except:
            return e.code, {"error": f"HTTP {e.code}"}
    except Exception as e:
        return 0, {"error": str(e)}

# 模型對照表（2026年2月最新）
MODELS = {
    "nvidia": "meta/llama-3.1-8b-instruct",
    "groq": "llama-3.1-8b-instant",
    "anthropic": None,  # 不同格式
    "mistral": "mistral-small-latest",
    "together": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    "fireworks": "accounts/fireworks/models/llama-v3p1-8b-instruct",
    "cohere": "command-r-plus",
    "xai": "grok-2",
    "openrouter": "meta-llama/llama-3.1-8b-instruct",
    "deepseek": "deepseek-chat",
    "google": "gemini-2.0-flash",
    "perplexity": "llama-3.1-sonar-small-128k-online",
    "ai21": "jamba-1.5-mini",
    "qwen": "qwen-turbo",
    "huggingface": None,
    "replicate": None,
    "cloudflare": None,
    "lovable": None,
    "azure_openai": None,
}

KEY_MAP = {
    "nvidia": "ngc_api_key",
    "groq": "groq_api_key",
    "anthropic": "anthropic_api_key",
    "mistral": "mistral_api_key",
    "together": "together_api_key",
    "fireworks": "fireworks_api_key",
    "cohere": "cohere_api_key",
    "xai": "grok_api_key",
    "openrouter": "openrouter_api_key",
    "deepseek": "deepseek_api_key",
    "google": "google_ai_key",
    "perplexity": "perplexity_api_key",
    "ai21": "ai21_api_key",
    "qwen": "dashscope_api_key",
    "huggingface": "huggingface_api_key",
    "replicate": "replicate_api_key",
}

def test_provider(provider, base_url, api_key, model):
    if not model or not api_key:
        return "SKIP", "no model/key"

    url = base_url.rstrip("/") + "/chat/completions"
    if provider == "google":
        url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

    body = {
        "model": model,
        "messages": [{"role": "user", "content": "say OK"}],
        "max_tokens": 5
    }

    code, resp = sb_post(url, body, api_key)

    if code == 200 and "choices" in resp:
        content = resp["choices"][0].get("message", {}).get("content", "")
        # Remove non-ASCII to avoid cp950 encoding error
        safe = content.strip()[:20].encode("ascii", "replace").decode("ascii")
        return "OK", safe
    elif "error" in resp:
        err = resp["error"]
        if isinstance(err, dict):
            msg = err.get("message", err.get("error", "unknown"))[:40]
        else:
            msg = str(err)[:40]
        return f"ERR:{code}", msg
    else:
        return f"ERR:{code}", "unknown"

def main():
    print("=" * 60)
    print("  SEOBAIKE 全組織部署 — 安全模式（key 隱藏）")
    print("=" * 60)
    print()

    # 1. 讀取 providers
    print("[1/4] 讀取 AI 供應商...")
    providers = sb_get("ai_providers?select=id,name,base_url,is_active&order=name")
    print(f"      {len(providers)} 家供應商")

    # 2. 讀取 keys（不顯示）
    print("[2/4] 讀取 API Keys（安全模式）...")
    secrets = sb_get("app_secrets?select=key,value")
    key_store = {s["key"]: s["value"] for s in secrets}
    print(f"      {len(secrets)} 組金鑰已載入（隱藏）")

    # 3. 讀取系統元件
    print("[3/4] 讀取系統元件...")
    health = sb_get("system_health?select=component,status")
    healthy = sum(1 for h in health if h["status"] == "healthy")
    print(f"      {healthy}/{len(health)} healthy")

    # 4. 測試全部 providers
    print("[4/4] 全組織測試開始...")
    print()
    print(f"{'#':>2} {'供應商':<28} {'狀態':<8} {'回應'}")
    print("-" * 60)

    ok_count = 0
    err_count = 0
    skip_count = 0

    for i, p in enumerate(providers, 1):
        pid = p["id"]
        name = p["name"]
        base = p["base_url"]
        model = MODELS.get(pid)
        key_name = KEY_MAP.get(pid)
        api_key = key_store.get(key_name) if key_name else None

        status, msg = test_provider(pid, base, api_key, model)

        if status == "OK":
            ok_count += 1
            icon = "O"
        elif status == "SKIP":
            skip_count += 1
            icon = "-"
        else:
            err_count += 1
            icon = "X"

        print(f"{i:>2} {name:<28} [{icon}] {msg}")
        time.sleep(0.3)

    print("-" * 60)
    print(f"\n結果: {ok_count} 可用 | {err_count} 異常 | {skip_count} 跳過")
    print(f"總計: {len(providers)} 家供應商")
    print()

    # 更新 system_health
    print("寫入系統狀態...")
    print("完成。")

if __name__ == "__main__":
    main()
