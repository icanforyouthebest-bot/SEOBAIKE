"""
AI Empire Health Check — Cloudflare 模組
掃描：Worker 狀態、DNS、WAF、SSL、Pages、KV
API: Cloudflare API v4
"""
import os, requests

CF_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CF_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
CF_ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID", "")
CF_BASE = "https://api.cloudflare.com/client/v4"


def _headers() -> dict:
    return {"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"}


def check_cloudflare() -> dict:
    result = {"status": "ok", "workers": [], "dns": [], "security": {}, "risks": []}
    if not CF_API_TOKEN:
        result["status"] = "skipped"
        result["risks"].append({"id": "CF-000", "level": "medium", "desc": "Cloudflare API token not configured"})
        return result

    h = _headers()

    # ── 1. Workers 清單 ───────────────────────────────────────
    try:
        r = requests.get(f"{CF_BASE}/accounts/{CF_ACCOUNT_ID}/workers/scripts", headers=h)
        if r.ok:
            scripts = r.json().get("result", [])
            result["workers"] = [s.get("id") for s in scripts]
            result["workers_count"] = len(scripts)
            if len(scripts) == 0:
                result["risks"].append({"id": "CF-001", "level": "high", "desc": "沒有部署任何 Cloudflare Worker"})
    except Exception as e:
        result["risks"].append({"id": "CF-001e", "level": "low", "desc": f"Worker scan error: {e}"})

    # ── 2. DNS 記錄 ───────────────────────────────────────────
    try:
        zone_id = CF_ZONE_ID
        if not zone_id:
            # 自動查詢 zone
            r = requests.get(f"{CF_BASE}/zones?name=aiforseo.vip", headers=h)
            if r.ok and r.json().get("result"):
                zone_id = r.json()["result"][0]["id"]

        if zone_id:
            r = requests.get(f"{CF_BASE}/zones/{zone_id}/dns_records?per_page=100", headers=h)
            if r.ok:
                records = r.json().get("result", [])
                result["dns_records_count"] = len(records)
                # 找沒有 proxy 的 A record（資安風險）
                for rec in records:
                    if rec.get("type") in ("A", "AAAA") and not rec.get("proxied"):
                        result["risks"].append({
                            "id": "CF-002", "level": "medium",
                            "desc": f"DNS 記錄 '{rec['name']}' 未走 Cloudflare Proxy（IP 暴露）"
                        })
    except Exception as e:
        result["risks"].append({"id": "CF-002e", "level": "low", "desc": f"DNS scan error: {e}"})

    # ── 3. SSL/TLS 設定 ───────────────────────────────────────
    try:
        if zone_id:
            r = requests.get(f"{CF_BASE}/zones/{zone_id}/settings/ssl", headers=h)
            if r.ok:
                ssl_mode = r.json().get("result", {}).get("value", "")
                result["security"]["ssl_mode"] = ssl_mode
                if ssl_mode in ("off", "flexible"):
                    result["risks"].append({
                        "id": "CF-003", "level": "high",
                        "desc": f"SSL 模式為 '{ssl_mode}'，應設為 Full (Strict)"
                    })
    except Exception:
        pass

    # ── 4. WAF / Firewall Rules ───────────────────────────────
    try:
        if zone_id:
            r = requests.get(f"{CF_BASE}/zones/{zone_id}/firewall/rules?per_page=25", headers=h)
            if r.ok:
                rules = r.json().get("result", [])
                result["security"]["waf_rules_count"] = len(rules)
                if len(rules) == 0:
                    result["risks"].append({
                        "id": "CF-004", "level": "medium",
                        "desc": "沒有設定任何 WAF / Firewall 規則"
                    })
    except Exception:
        pass

    # ── 5. Worker KV Namespaces ───────────────────────────────
    try:
        r = requests.get(f"{CF_BASE}/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces", headers=h)
        if r.ok:
            kvs = r.json().get("result", [])
            result["kv_namespaces"] = [kv.get("title") for kv in kvs]
            result["kv_count"] = len(kvs)
    except Exception:
        pass

    # ── 6. Pages Projects ────────────────────────────────────
    try:
        r = requests.get(f"{CF_BASE}/accounts/{CF_ACCOUNT_ID}/pages/projects", headers=h)
        if r.ok:
            pages = r.json().get("result", [])
            result["pages_projects"] = [p.get("name") for p in pages]
            result["pages_count"] = len(pages)
    except Exception:
        pass

    return result
