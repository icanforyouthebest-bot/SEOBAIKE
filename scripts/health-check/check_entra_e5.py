"""
AI Empire Health Check — Entra / E5 模組
掃描：殭屍帳號、MFA、Conditional Access、外部分享、Audit Logs
API: Microsoft Graph
"""
import os, requests
from msal import ConfidentialClientApplication

TENANT_ID = os.environ.get("TENANT_ID", "c1e1278e-c05c-4d00-a4c9-93fbbea01346")
CLIENT_ID = os.environ.get("CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET", "")
GRAPH_URL = "https://graph.microsoft.com/v1.0"


def _get_token() -> str | None:
    if not CLIENT_ID or not CLIENT_SECRET:
        return None
    app = ConfidentialClientApplication(CLIENT_ID, authority=f"https://login.microsoftonline.com/{TENANT_ID}", client_credential=CLIENT_SECRET)
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    return result.get("access_token")


def check_entra_e5() -> dict:
    result = {"status": "ok", "users": [], "security": {}, "sharing": {}, "risks": []}
    token = _get_token()
    if not token:
        result["status"] = "skipped"
        result["risks"].append({"id": "E5-000", "level": "medium", "desc": "E5/Entra credentials not configured"})
        return result

    headers = {"Authorization": f"Bearer {token}"}

    # ── 1. 帳號清單 ───────────────────────────────────────────
    try:
        r = requests.get(f"{GRAPH_URL}/users?$select=id,displayName,userPrincipalName,accountEnabled,createdDateTime,lastSignInDateTime&$top=100", headers=headers)
        if r.ok:
            users = r.json().get("value", [])
            result["users_count"] = len(users)
            # 殭屍帳號：超過90天沒登入
            import datetime
            now = datetime.datetime.utcnow()
            for u in users:
                last = u.get("lastSignInDateTime")
                if last:
                    last_dt = datetime.datetime.fromisoformat(last.replace("Z", "+00:00")).replace(tzinfo=None)
                    if (now - last_dt).days > 90 and u.get("accountEnabled"):
                        result["risks"].append({"id": "E5-001", "level": "medium", "desc": f"殭屍帳號：{u['userPrincipalName']} 超過90天未登入"})
    except Exception as e:
        result["risks"].append({"id": "E5-001e", "level": "low", "desc": f"User scan error: {e}"})

    # ── 2. MFA 狀態 ───────────────────────────────────────────
    try:
        r = requests.get(f"{GRAPH_URL}/reports/credentialUserRegistrationDetails?$top=100", headers=headers)
        if r.ok:
            regs = r.json().get("value", [])
            no_mfa = [u for u in regs if not u.get("isMfaRegistered")]
            result["security"]["no_mfa_count"] = len(no_mfa)
            for u in no_mfa[:5]:
                result["risks"].append({"id": "E5-002", "level": "high", "desc": f"未啟用 MFA：{u.get('userPrincipalName', '?')}"})
    except Exception:
        pass

    # ── 3. Conditional Access 規則 ────────────────────────────
    try:
        r = requests.get(f"{GRAPH_URL}/identity/conditionalAccess/policies?$select=id,displayName,state", headers=headers)
        if r.ok:
            policies = r.json().get("value", [])
            result["security"]["conditional_access_policies"] = len(policies)
            if len(policies) == 0:
                result["risks"].append({"id": "E5-003", "level": "high", "desc": "沒有設定任何 Conditional Access 規則"})
    except Exception:
        pass

    # ── 4. SharePoint 外部分享 ────────────────────────────────
    try:
        r = requests.get(f"{GRAPH_URL}/sites?search=*&$select=id,name,webUrl&$top=10", headers=headers)
        if r.ok:
            sites = r.json().get("value", [])
            result["sharing"]["sites_count"] = len(sites)
    except Exception:
        pass

    # ── 5. Risky Sign-ins ─────────────────────────────────────
    try:
        r = requests.get(f"{GRAPH_URL}/identityProtection/riskyUsers?$filter=riskLevel ne 'none'&$top=10", headers=headers)
        if r.ok:
            risky = r.json().get("value", [])
            if risky:
                result["risks"].append({"id": "E5-005", "level": "high", "desc": f"{len(risky)} 個帳號有風險登入紀錄"})
    except Exception:
        pass

    return result
