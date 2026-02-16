"""
SEOBAIKE L1→L4 Pipeline — Azure Functions
專利 115100981「世界定義約束法用於AI推理」
"""
import azure.functions as func
import json
import logging
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vmyrivxxibqydccurxug.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
AI_ROUTER_URL = os.environ.get("AI_ROUTER_URL", "")


def supabase_get(path):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        logging.error(f"Supabase GET error: {e}")
        return []


def check_inference_path(l1_id, l2_id, l3_id, l4_id):
    l1 = supabase_get(f"l1_categories?id=eq.{l1_id}&select=id,name")
    if not l1:
        return {"status": "denied", "reason": f"L1 '{l1_id}' not found"}

    l2 = supabase_get(f"l2_subcategories?id=eq.{l2_id}&l1_id=eq.{l1_id}&select=id,name")
    if not l2:
        return {"status": "denied", "reason": f"L2 '{l2_id}' not under L1 '{l1_id}'"}

    l3 = supabase_get(f"l3_processes?id=eq.{l3_id}&l2_id=eq.{l2_id}&select=id,name")
    if not l3:
        return {"status": "denied", "reason": f"L3 '{l3_id}' not under L2 '{l2_id}'"}

    l4 = supabase_get(f"l4_nodes?id=eq.{l4_id}&l3_id=eq.{l3_id}&select=id,name")
    if not l4:
        return {"status": "denied", "reason": f"L4 '{l4_id}' not under L3 '{l3_id}'"}

    return {
        "status": "allowed",
        "path": f"{l1[0]['name']} → {l2[0]['name']} → {l3[0]['name']} → {l4[0]['name']}"
    }


def post_json(url, data, headers=None):
    h = headers or {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


@app.route(route="inference", methods=["POST"])
def inference_pipeline(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse(json.dumps({"error": "Invalid JSON"}), status_code=400, mimetype="application/json")

    l1 = str(body.get("l1_id", body.get("l1", "")))
    l2 = str(body.get("l2_id", body.get("l2", "")))
    l3 = str(body.get("l3_id", body.get("l3", "")))
    l4 = str(body.get("l4_id", body.get("l4", "")))
    prompt = body.get("prompt", body.get("message", ""))
    model = body.get("model", "auto")
    provider = body.get("provider", "auto")

    if not prompt:
        return func.HttpResponse(json.dumps({"error": "prompt is required"}), status_code=400, mimetype="application/json")

    path_result = {"status": "bypass", "reason": "no path specified"}
    if l1 and l2 and l3 and l4:
        path_result = check_inference_path(l1, l2, l3, l4)
        if path_result["status"] != "allowed":
            return func.HttpResponse(json.dumps({"error": "inference_path_denied", "detail": path_result["reason"], "patent": "115100981"}), status_code=403, mimetype="application/json")

    ai_request = {"messages": [{"role": "user", "content": prompt}], "model": model, "provider": provider, "max_tokens": body.get("max_tokens", 1000), "path_check": path_result}

    if AI_ROUTER_URL:
        result = post_json(f"{AI_ROUTER_URL}/api/route", ai_request)
    else:
        result = {"message": "AI Router not configured", "path_check": path_result}

    return func.HttpResponse(json.dumps({"result": result, "pipeline": {"path_check": path_result, "timestamp": datetime.now(timezone.utc).isoformat(), "patent": "115100981", "owner": "小路光有限公司"}}), mimetype="application/json")


@app.route(route="health", methods=["GET"])
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(json.dumps({"status": "healthy", "service": "l1-l4-pipeline", "patent": "115100981", "owner": "SEOBAIKE", "timestamp": datetime.now(timezone.utc).isoformat()}), mimetype="application/json")


@app.route(route="paths", methods=["GET"])
def list_paths(req: func.HttpRequest) -> func.HttpResponse:
    l1 = supabase_get("l1_categories?select=id,name&order=id&limit=50")
    return func.HttpResponse(json.dumps({"l1_categories": l1}), mimetype="application/json")
