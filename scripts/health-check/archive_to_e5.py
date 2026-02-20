"""
AI Empire Health Check — E5 歸檔模組
把健康檢查報告上傳到 E5 SharePoint / OneDrive
API: Microsoft Graph
"""
import os, json, requests
from msal import ConfidentialClientApplication

TENANT_ID       = os.environ.get("TENANT_ID", "c1e1278e-c05c-4d00-a4c9-93fbbea01346")
CLIENT_ID       = os.environ.get("CLIENT_ID", "")
CLIENT_SECRET   = os.environ.get("CLIENT_SECRET", "")
GRAPH_URL       = "https://graph.microsoft.com/v1.0"
ONEDRIVE_FOLDER = "SEOBAIKE/healthcheck"
# Service principal target user — set to tenant admin UPN, e.g. admin@aiempire.onmicrosoft.com
# Required when using client_credentials flow (E5-Automation app), because /me/drive is invalid
# for service principals; must use /users/{upn-or-id}/drive instead.
E5_TARGET_USER  = os.environ.get("E5_TARGET_USER", "")

# Azure Blob Storage fallback (用訂閱內的免費 Storage Account)
AZURE_STORAGE_ACCOUNT            = os.environ.get("AZURE_STORAGE_ACCOUNT", "seobaikestore")
AZURE_STORAGE_CONTAINER          = os.environ.get("AZURE_STORAGE_CONTAINER", "healthcheck")
AZURE_STORAGE_SAS_TOKEN          = os.environ.get("AZURE_STORAGE_SAS_TOKEN", "")
AZURE_STORAGE_CONNECTION_STRING  = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", "")


def _get_token() -> str | None:
    if not CLIENT_ID or not CLIENT_SECRET:
        return None
    app = ConfidentialClientApplication(
        CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{TENANT_ID}",
        client_credential=CLIENT_SECRET
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])
    return result.get("access_token")


def _provision_onedrive(token: str, upn: str) -> bool:
    """觸發 OneDrive 佈建 — 首次 GET /users/{upn}/drive 會自動建立"""
    try:
        r = requests.get(
            f"{GRAPH_URL}/users/{upn}/drive",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20
        )
        if r.ok:
            print(f"  [E5] OneDrive for {upn} OK (drive id: {r.json().get('id','?')[:8]}…)")
            return True
        print(f"  [E5] OneDrive provision attempt HTTP {r.status_code}: {r.text[:80]}")
        return False
    except Exception as e:
        print(f"  [E5] OneDrive provision error: {e}")
        return False


def _get_or_create_sharepoint_site(token: str) -> str | None:
    """取得或嘗試建立 SEOBAIKE SharePoint 站台，回傳 drive_id"""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # 1. 嘗試取得現有站台
    for host_guess in ["AIEmpire", "seobaike", "icanforyouthebest"]:
        site_r = requests.get(
            f"{GRAPH_URL}/sites/{host_guess}.sharepoint.com:/sites/SEOBAIKE",
            headers={"Authorization": f"Bearer {token}"}, timeout=15
        )
        if site_r.ok:
            site_id = site_r.json().get("id")
            drive_r = requests.get(f"{GRAPH_URL}/sites/{site_id}/drive",
                                   headers={"Authorization": f"Bearer {token}"}, timeout=10)
            if drive_r.ok:
                print(f"  [E5] SharePoint site found at {host_guess}.sharepoint.com/sites/SEOBAIKE")
                return drive_r.json().get("id")

    # 2. 嘗試搜尋站台
    search_r = requests.get(f"{GRAPH_URL}/sites?search=SEOBAIKE",
                            headers={"Authorization": f"Bearer {token}"}, timeout=15)
    if search_r.ok:
        sites = search_r.json().get("value", [])
        if sites:
            site_id = sites[0]["id"]
            drive_r = requests.get(f"{GRAPH_URL}/sites/{site_id}/drive",
                                   headers={"Authorization": f"Bearer {token}"}, timeout=10)
            if drive_r.ok:
                print(f"  [E5] SharePoint site found via search: {sites[0].get('webUrl','?')}")
                return drive_r.json().get("id")

    # 3. 嘗試建立 Microsoft 365 Group（會自動建立 SharePoint 站台）
    try:
        create_r = requests.post(
            f"{GRAPH_URL}/groups",
            headers=headers,
            json={
                "displayName": "SEOBAIKE-AI-Empire",
                "mailNickname": "seobaike-ai-empire",
                "mailEnabled": True,
                "securityEnabled": False,
                "groupTypes": ["Unified"],
                "visibility": "Private"
            }, timeout=20
        )
        if create_r.ok:
            group_id = create_r.json().get("id")
            print(f"  [E5] Created M365 Group {group_id} — SharePoint will provision in ~60s")
            # SharePoint 需要時間佈建，這次先回傳 None，下次 CI 跑就有了
    except Exception:
        pass
    return None


def _upload_to_onedrive(token: str, filename: str, content: bytes, content_type: str = "application/json") -> bool:
    """上傳檔案到 OneDrive (Drive root)

    Service principal (client_credentials) 必須用 /users/{upn}/drive 而非 /me/drive。
    E5_TARGET_USER 設為租戶管理員的 UPN（如 admin@aiempire.onmicrosoft.com）。
    """
    headers_auth = {"Authorization": f"Bearer {token}", "Content-Type": content_type}

    if E5_TARGET_USER:
        # 先觸發 OneDrive 佈建（首次建立需要這步）
        _provision_onedrive(token, E5_TARGET_USER)
        # Service principal path: requires Files.ReadWrite.All (Application permission)
        url = f"{GRAPH_URL}/users/{E5_TARGET_USER}/drive/root:/{ONEDRIVE_FOLDER}/{filename}:/content"
    else:
        # Delegated flow fallback (only works with user tokens, not service principals)
        url = f"{GRAPH_URL}/me/drive/root:/{ONEDRIVE_FOLDER}/{filename}:/content"

    r = requests.put(url, headers=headers_auth, data=content, timeout=30)
    if r.ok:
        return True

    print(f"  [E5] OneDrive upload HTTP {r.status_code} — trying SharePoint site drive…")

    # 改用 SharePoint 站台 drive 方式
    drive_id = _get_or_create_sharepoint_site(token)
    if drive_id:
        url2 = f"{GRAPH_URL}/drives/{drive_id}/root:/{ONEDRIVE_FOLDER}/{filename}:/content"
        r2 = requests.put(url2, headers=headers_auth, data=content, timeout=30)
        if r2.ok:
            return True
        print(f"  [E5] SharePoint drive upload HTTP {r2.status_code}: {r2.text[:80]}")

    return False


def _send_teams_notification(token: str, version_id: str, summary: dict) -> bool:
    """發 Teams 通知（找第一個 Team 的 General channel）"""
    try:
        r = requests.get(f"{GRAPH_URL}/me/joinedTeams", headers={"Authorization": f"Bearer {token}"})
        if not r.ok:
            return False
        teams = r.json().get("value", [])
        if not teams:
            return False
        team_id = teams[0]["id"]

        total = summary.get("total_risks", 0)
        high = len(summary.get("high", []))
        medium = len(summary.get("medium", []))

        emoji = "🔴" if high > 0 else "🟡" if medium > 0 else "🟢"
        text = (
            f"{emoji} **AI Empire Health Check 完成** `{version_id}`\n\n"
            f"- 總風險: {total}\n"
            f"- 高風險: {high}\n"
            f"- 中風險: {medium}\n\n"
        )
        if summary.get("high"):
            text += "**高風險項目:**\n"
            for r_item in summary["high"][:5]:
                text += f"- [{r_item.get('module','?').upper()}] {r_item.get('desc','')}\n"

        msg_r = requests.post(
            f"{GRAPH_URL}/teams/{team_id}/channels/19:General/messages",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"body": {"contentType": "markdown", "content": text}}
        )
        return msg_r.ok
    except Exception:
        return False


def _upload_to_azure_blob(filename: str, content: bytes, content_type: str = "application/json") -> bool:
    """Azure Blob Storage — 支援連接字串（優先）或 SAS token"""
    if not AZURE_STORAGE_ACCOUNT:
        return False

    # 方法 1：連接字串（推薦，用 azure-storage-blob SDK）
    if AZURE_STORAGE_CONNECTION_STRING:
        try:
            from azure.storage.blob import BlobServiceClient, ContentSettings
            svc = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            blob = svc.get_blob_client(container=AZURE_STORAGE_CONTAINER, blob=filename)
            blob.upload_blob(
                content, overwrite=True,
                content_settings=ContentSettings(content_type=content_type)
            )
            return True
        except ImportError:
            print("  [Azure Blob] azure-storage-blob not installed, trying SAS fallback...")
        except Exception as e:
            print(f"  [Azure Blob] Connection string upload failed: {e}")
            return False

    # 方法 2：SAS token
    if not AZURE_STORAGE_SAS_TOKEN:
        return False
    sas = AZURE_STORAGE_SAS_TOKEN.lstrip("?")
    url = (f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"
           f"/{AZURE_STORAGE_CONTAINER}/{filename}?{sas}")
    try:
        r = requests.put(url, data=content, headers={
            "x-ms-blob-type": "BlockBlob",
            "Content-Type": content_type
        }, timeout=15)
        return r.ok
    except Exception:
        return False


def archive_results(version_id: str, full_report: dict, report_md: str) -> dict:
    """
    把 JSON + MD 報告上傳到 E5 OneDrive（主）或 Azure Blob（備）
    """
    archive_result = {"json_uploaded": False, "md_uploaded": False, "teams_notified": False}

    token = _get_token()
    if not token:
        # OneDrive 失敗 → 嘗試 Azure Blob Storage fallback
        print("  [Archive] E5 credentials missing — 嘗試 Azure Blob fallback...")
        json_bytes = json.dumps(full_report, ensure_ascii=False, indent=2).encode("utf-8")
        blob_ok = _upload_to_azure_blob(f"healthcheck_{version_id}.json", json_bytes)
        archive_result["json_uploaded"] = blob_ok
        archive_result["method"] = "azure_blob" if blob_ok else "none"
        archive_result["error"] = "E5 credentials not configured"
        print(f"  [Archive] Azure Blob fallback: {'OK' if blob_ok else 'FAIL (no SAS token)'}")
        return archive_result

    # 上傳 JSON
    json_bytes = json.dumps(full_report, ensure_ascii=False, indent=2).encode("utf-8")
    json_ok = _upload_to_onedrive(token, f"healthcheck_{version_id}.json", json_bytes, "application/json")
    archive_result["json_uploaded"] = json_ok
    print(f"  [Archive] JSON {'OK' if json_ok else 'FAIL'} -> OneDrive/{ONEDRIVE_FOLDER}/healthcheck_{version_id}.json")

    if not json_ok:
        # OneDrive 上傳失敗 → 嘗試 Azure Blob fallback
        blob_ok = _upload_to_azure_blob(f"healthcheck_{version_id}.json", json_bytes)
        if blob_ok:
            archive_result["json_uploaded"] = True
            archive_result["method"] = "azure_blob"
            print(f"  [Archive] JSON Azure Blob fallback: OK")

    # 上傳 MD
    md_bytes = report_md.encode("utf-8")
    md_ok = _upload_to_onedrive(token, f"healthcheck_{version_id}.md", md_bytes, "text/markdown")
    archive_result["md_uploaded"] = md_ok
    print(f"  [Archive] MD  {'OK' if md_ok else 'FAIL'} -> OneDrive/{ONEDRIVE_FOLDER}/healthcheck_{version_id}.md")

    # Teams 通知
    teams_ok = _send_teams_notification(token, version_id, full_report.get("summary", {}))
    archive_result["teams_notified"] = teams_ok
    print(f"  [Archive] Teams: {'OK' if teams_ok else 'FAIL'}")

    return archive_result
