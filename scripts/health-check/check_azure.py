"""
AI Empire Health Check — Azure 模組
掃描：資源清單、安全設定、成本用量、AI服務
API: Azure Resource Graph, Management API, Monitor, Cost Management
"""
import os, requests

SUBSCRIPTION_ID = os.environ.get("AZURE_SUBSCRIPTION_ID", "fca96658-74df-4d3e-9212-aade3e98ca1f")
TENANT_ID = os.environ.get("AZURE_TENANT_ID", "c1e1278e-c05c-4d00-a4c9-93fbbea01346")
CLIENT_ID = os.environ.get("AZURE_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("AZURE_CLIENT_SECRET", "")


def _get_token() -> str | None:
    if not CLIENT_ID or not CLIENT_SECRET:
        return None
    r = requests.post(
        f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
        data={"grant_type": "client_credentials", "client_id": CLIENT_ID,
              "client_secret": CLIENT_SECRET, "scope": "https://management.azure.com/.default"}
    )
    return r.json().get("access_token") if r.ok else None


def check_azure() -> dict:
    result = {"status": "ok", "resources": [], "security": [], "ai_services": [], "risks": []}
    token = _get_token()
    if not token:
        result["status"] = "skipped"
        result["risks"].append({"id": "AZ-000", "level": "medium", "desc": "Azure credentials not configured"})
        return result

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # ── 1. 資源清單 (Resource Graph) ──────────────────────────
    try:
        r = requests.post(
            "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01",
            headers=headers,
            json={"query": "Resources | project name, type, resourceGroup, location | limit 100",
                  "subscriptions": [SUBSCRIPTION_ID]}
        )
        if r.ok:
            result["resources"] = r.json().get("data", [])
    except Exception as e:
        result["risks"].append({"id": "AZ-001", "level": "low", "desc": f"Resource Graph error: {e}"})

    # ── 2. 安全設定 — Storage 匿名存取 ────────────────────────
    try:
        r = requests.post(
            "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01",
            headers=headers,
            json={"query": "Resources | where type == 'microsoft.storage/storageaccounts' | project name, properties.allowBlobPublicAccess",
                  "subscriptions": [SUBSCRIPTION_ID]}
        )
        if r.ok:
            for sa in r.json().get("data", []):
                if sa.get("properties_allowBlobPublicAccess"):
                    result["risks"].append({
                        "id": "AZ-002", "level": "high",
                        "desc": f"Storage '{sa['name']}' allows public blob access"
                    })
    except Exception:
        pass

    # ── 3. Key Vault 安全 ──────────────────────────────────────
    try:
        r = requests.post(
            "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01",
            headers=headers,
            json={"query": "Resources | where type == 'microsoft.keyvault/vaults' | project name, properties.networkAcls",
                  "subscriptions": [SUBSCRIPTION_ID]}
        )
        if r.ok:
            for kv in r.json().get("data", []):
                acls = kv.get("properties_networkAcls", {})
                if not acls or acls.get("defaultAction") == "Allow":
                    result["risks"].append({
                        "id": "AZ-003", "level": "high",
                        "desc": f"Key Vault '{kv['name']}' has open network access"
                    })
    except Exception:
        pass

    # ── 4. Azure OpenAI / Cognitive Services ──────────────────
    try:
        r = requests.post(
            "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01",
            headers=headers,
            json={"query": "Resources | where type contains 'openai' or type contains 'cognitiveservices' | project name, type, location, properties.publicNetworkAccess",
                  "subscriptions": [SUBSCRIPTION_ID]}
        )
        if r.ok:
            result["ai_services"] = r.json().get("data", [])
            for ai in result["ai_services"]:
                if ai.get("properties_publicNetworkAccess") == "Enabled":
                    result["risks"].append({
                        "id": "AZ-004", "level": "medium",
                        "desc": f"AI service '{ai['name']}' has public network access"
                    })
    except Exception:
        pass

    result["resources_count"] = len(result["resources"])
    result["ai_services_count"] = len(result["ai_services"])
    return result
