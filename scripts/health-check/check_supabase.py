"""
AI Empire Health Check — Supabase 模組
掃描：Edge Functions、DB 連線、RLS 政策、Auth 設定、資料表
API: Supabase Management API + REST API
"""
import os, requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_KEY", ""))
SUPABASE_PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "")
SUPABASE_ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
MGMT_BASE = "https://api.supabase.com/v1"


def check_supabase() -> dict:
    result = {"status": "ok", "functions": [], "tables": [], "security": {}, "risks": []}

    if not SUPABASE_URL or not SUPABASE_KEY:
        result["status"] = "skipped"
        result["risks"].append({"id": "SB-000", "level": "medium", "desc": "Supabase credentials not configured"})
        return result

    rest_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    mgmt_headers = {
        "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    } if SUPABASE_ACCESS_TOKEN else None

    # ── 1. DB 連線健康 ────────────────────────────────────────
    try:
        r = requests.get(f"{SUPABASE_URL}/rest/v1/", headers=rest_headers, timeout=10)
        if r.ok:
            result["db_status"] = "connected"
        else:
            result["db_status"] = f"error_{r.status_code}"
            result["risks"].append({"id": "SB-001", "level": "high", "desc": f"Supabase REST API 無法連接: {r.status_code}"})
    except Exception as e:
        result["risks"].append({"id": "SB-001e", "level": "high", "desc": f"Supabase 連線錯誤: {e}"})

    # ── 2. Edge Functions 清單 (Management API) ──────────────
    if mgmt_headers and SUPABASE_PROJECT_REF:
        try:
            r = requests.get(f"{MGMT_BASE}/projects/{SUPABASE_PROJECT_REF}/functions", headers=mgmt_headers)
            if r.ok:
                fns = r.json()
                result["functions"] = [f.get("slug") for f in fns]
                result["functions_count"] = len(fns)
                if len(fns) == 0:
                    result["risks"].append({"id": "SB-002", "level": "medium", "desc": "沒有部署任何 Edge Function"})
        except Exception as e:
            result["risks"].append({"id": "SB-002e", "level": "low", "desc": f"Functions scan error: {e}"})

    # ── 3. 資料表清單 ─────────────────────────────────────────
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/",
            headers={**rest_headers, "Accept": "application/openapi+json"},
            timeout=10
        )
        if r.ok:
            try:
                schema = r.json()
                paths = schema.get("paths", {})
                tables = [p.lstrip("/") for p in paths.keys() if not p.startswith("/rpc")]
                result["tables"] = tables[:20]
                result["tables_count"] = len(tables)
            except Exception:
                pass
    except Exception:
        pass

    # ── 4. Auth 設定 ──────────────────────────────────────────
    if mgmt_headers and SUPABASE_PROJECT_REF:
        try:
            r = requests.get(f"{MGMT_BASE}/projects/{SUPABASE_PROJECT_REF}/config/auth", headers=mgmt_headers)
            if r.ok:
                auth_cfg = r.json()
                result["security"]["email_confirm"] = auth_cfg.get("mailer_autoconfirm", True)
                if auth_cfg.get("mailer_autoconfirm"):
                    result["risks"].append({
                        "id": "SB-003", "level": "medium",
                        "desc": "Auth 設定為自動確認 Email（安全性較低）"
                    })
        except Exception:
            pass

    # ── 5. 已知核心資料表 RLS 檢查 ───────────────────────────
    core_tables = ["users", "customers", "subscriptions", "api_logs", "seo_data"]
    for tbl in core_tables:
        try:
            # 嘗試在沒有 JWT 的情況下存取，如果成功代表 RLS 可能有問題
            r = requests.get(
                f"{SUPABASE_URL}/rest/v1/{tbl}?limit=1",
                headers={"apikey": SUPABASE_KEY, "Authorization": "Bearer INVALID_TOKEN"},
                timeout=5
            )
            if r.status_code == 200:
                result["risks"].append({
                    "id": "SB-004", "level": "high",
                    "desc": f"資料表 '{tbl}' 可能未啟用 RLS（無效 JWT 仍可讀取）"
                })
        except Exception:
            pass

    # ── 6. 儲存空間 ───────────────────────────────────────────
    if mgmt_headers and SUPABASE_PROJECT_REF:
        try:
            r = requests.get(f"{MGMT_BASE}/projects/{SUPABASE_PROJECT_REF}/storage/buckets", headers=mgmt_headers)
            if r.ok:
                buckets = r.json()
                result["storage_buckets"] = [b.get("name") for b in buckets]
                for b in buckets:
                    if b.get("public"):
                        result["risks"].append({
                            "id": "SB-005", "level": "medium",
                            "desc": f"Storage bucket '{b['name']}' 為公開存取"
                        })
        except Exception:
            pass

    return result
