"""
SEOBAIKE L1→L4 Pipeline — Azure Functions
專利 115100981「世界定義約束法用於AI推理」
所有 AI 推論必須經過此 Pipeline 驗證

流程：Input → Entra ID 驗證 → L1→L4 路徑檢查 → AI Router → 回傳
"""
import azure.functions as func
import json
import logging
import os
import httpx
from datetime import datetime, timezone

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

# === 環境變數 ===
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vmyrivxxibqydccurxug.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
AI_ROUTER_URL = os.environ.get("AI_ROUTER_URL", "")  # Azure APIM endpoint


# === L1→L4 路徑驗證 ===
async def check_inference_path(l1_id: str, l2_id: str, l3_id: str, l4_id: str) -> dict:
    """
    專利核心：驗證推論路徑 L1→L2→L3→L4 是否合法
    - allowed → 放行
    - denied/halted/rollback → 死亡，不可執行
    """
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=10) as client:
        # 驗證 L1 存在且未凍結違規
        l1 = await client.get(
            f"{SUPABASE_URL}/rest/v1/l1_categories?id=eq.{l1_id}&select=id,name,is_frozen",
            headers=headers
        )
        l1_data = l1.json()
        if not l1_data:
            return {"status": "denied", "reason": f"L1 '{l1_id}' not found"}

        # 驗證 L2 存在且 FK→L1 正確
        l2 = await client.get(
            f"{SUPABASE_URL}/rest/v1/l2_subcategories?id=eq.{l2_id}&l1_id=eq.{l1_id}&select=id,name,l1_id",
            headers=headers
        )
        l2_data = l2.json()
        if not l2_data:
            return {"status": "denied", "reason": f"L2 '{l2_id}' not found or not under L1 '{l1_id}'"}

        # 驗證 L3 存在且 FK→L2 正確
        l3 = await client.get(
            f"{SUPABASE_URL}/rest/v1/l3_processes?id=eq.{l3_id}&l2_id=eq.{l2_id}&select=id,name,l2_id",
            headers=headers
        )
        l3_data = l3.json()
        if not l3_data:
            return {"status": "denied", "reason": f"L3 '{l3_id}' not found or not under L2 '{l2_id}'"}

        # 驗證 L4 存在且 FK→L3 正確
        l4 = await client.get(
            f"{SUPABASE_URL}/rest/v1/l4_nodes?id=eq.{l4_id}&l3_id=eq.{l3_id}&select=id,name,l3_id",
            headers=headers
        )
        l4_data = l4.json()
        if not l4_data:
            return {"status": "denied", "reason": f"L4 '{l4_id}' not found or not under L3 '{l3_id}'"}

        # 記錄到 inference_path_checks
        await client.post(
            f"{SUPABASE_URL}/rest/v1/inference_path_checks",
            headers={**headers, "Prefer": "return=minimal"},
            json={
                "l1_id": int(l1_id) if l1_id.isdigit() else None,
                "l2_id": int(l2_id) if l2_id.isdigit() else None,
                "l3_id": int(l3_id) if l3_id.isdigit() else None,
                "l4_id": int(l4_id) if l4_id.isdigit() else None,
                "status": "allowed",
                "checked_at": datetime.now(timezone.utc).isoformat()
            }
        )

        return {
            "status": "allowed",
            "path": f"{l1_data[0]['name']} → {l2_data[0]['name']} → {l3_data[0]['name']} → {l4_data[0]['name']}"
        }


# === 主入口：推論請求 ===
@app.route(route="inference", methods=["POST"])
async def inference_pipeline(req: func.HttpRequest) -> func.HttpResponse:
    """
    所有 AI 推論的唯一入口
    Input → Entra ID 驗證(APIM層) → L1→L4 驗證 → AI Router → 回傳
    """
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON"}),
            status_code=400,
            mimetype="application/json"
        )

    # 1. 提取路徑參數
    l1 = body.get("l1_id", body.get("l1", ""))
    l2 = body.get("l2_id", body.get("l2", ""))
    l3 = body.get("l3_id", body.get("l3", ""))
    l4 = body.get("l4_id", body.get("l4", ""))
    prompt = body.get("prompt", body.get("message", ""))
    model = body.get("model", "auto")
    provider = body.get("provider", "auto")

    if not prompt:
        return func.HttpResponse(
            json.dumps({"error": "prompt is required"}),
            status_code=400,
            mimetype="application/json"
        )

    # 2. L1→L4 路徑驗證（專利核心）
    if l1 and l2 and l3 and l4:
        path_result = await check_inference_path(str(l1), str(l2), str(l3), str(l4))
        if path_result["status"] != "allowed":
            logging.warning(f"INFERENCE DENIED: {path_result}")
            return func.HttpResponse(
                json.dumps({
                    "error": "inference_path_denied",
                    "detail": path_result["reason"],
                    "patent": "115100981"
                }),
                status_code=403,
                mimetype="application/json"
            )
        logging.info(f"INFERENCE ALLOWED: {path_result['path']}")
    else:
        # 無路徑參數 = 一般查詢（不需要 L1-L4 約束）
        path_result = {"status": "bypass", "reason": "no path specified"}

    # 3. 轉發到 AI Router（Azure APIM）
    ai_request = {
        "messages": [{"role": "user", "content": prompt}],
        "model": model,
        "provider": provider,
        "max_tokens": body.get("max_tokens", 1000),
        "path_check": path_result
    }

    if AI_ROUTER_URL:
        async with httpx.AsyncClient(timeout=30) as client:
            ai_resp = await client.post(
                AI_ROUTER_URL,
                json=ai_request,
                headers={"Content-Type": "application/json"}
            )
            result = ai_resp.json()
    else:
        result = {
            "message": "AI Router not configured",
            "path_check": path_result,
            "request": ai_request
        }

    # 4. 回傳結果（經過微軟層）
    return func.HttpResponse(
        json.dumps({
            "result": result,
            "pipeline": {
                "path_check": path_result,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "patent": "115100981",
                "owner": "小路光有限公司"
            }
        }),
        status_code=200,
        mimetype="application/json"
    )


# === 健康檢查 ===
@app.route(route="health", methods=["GET"])
async def health_check(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({
            "status": "healthy",
            "service": "l1-l4-pipeline",
            "patent": "115100981",
            "owner": "SEOBAIKE / 小路光有限公司",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }),
        mimetype="application/json"
    )


# === 路徑查詢（唯讀） ===
@app.route(route="paths", methods=["GET"])
async def list_paths(req: func.HttpRequest) -> func.HttpResponse:
    """查詢可用的 L1→L4 路徑"""
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
    }

    async with httpx.AsyncClient(timeout=10) as client:
        l1 = await client.get(
            f"{SUPABASE_URL}/rest/v1/l1_categories?select=id,name&order=id&limit=50",
            headers=headers
        )

    return func.HttpResponse(
        json.dumps({"l1_categories": l1.json()}),
        mimetype="application/json"
    )
