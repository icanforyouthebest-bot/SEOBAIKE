"""
AI Empire Health Check — E5 歸檔模組
把健康檢查報告上傳到 E5 SharePoint / OneDrive
API: Microsoft Graph
"""
import os, json, requests
from msal import ConfidentialClientApplication

TENANT_ID = os.environ.get("TENANT_ID", "c1e1278e-c05c-4d00-a4c9-93fbbea01346")
CLIENT_ID = os.environ.get("CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET", "")
GRAPH_URL = "https://graph.microsoft.com/v1.0"

# SharePoint / OneDrive 目標路徑
ONEDRIVE_FOLDER = "SEOBAIKE/healthcheck"


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


def _upload_to_onedrive(token: str, filename: str, content: bytes, content_type: str = "application/json") -> bool:
    """上傳檔案到 OneDrive (Drive root)"""
    url = f"{GRAPH_URL}/me/drive/root:/{ONEDRIVE_FOLDER}/{filename}:/content"
    # 嘗試 /drive/root 找 service account
    r = requests.put(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type
        },
        data=content
    )
    if not r.ok:
        # 改用 sites/{siteId}/drive 方式
        try:
            site_r = requests.get(
                f"{GRAPH_URL}/sites/AIEmpire.sharepoint.com:/sites/SEOBAIKE",
                headers={"Authorization": f"Bearer {token}"}
            )
            if site_r.ok:
                site_id = site_r.json().get("id")
                drive_r = requests.get(
                    f"{GRAPH_URL}/sites/{site_id}/drive",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if drive_r.ok:
                    drive_id = drive_r.json().get("id")
                    url2 = f"{GRAPH_URL}/drives/{drive_id}/root:/{ONEDRIVE_FOLDER}/{filename}:/content"
                    r2 = requests.put(
                        url2,
                        headers={"Authorization": f"Bearer {token}", "Content-Type": content_type},
                        data=content
                    )
                    return r2.ok
        except Exception:
            pass
    return r.ok


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


def archive_results(version_id: str, full_report: dict, report_md: str) -> dict:
    """
    把 JSON + MD 報告上傳到 E5 OneDrive，並發 Teams 通知
    """
    archive_result = {"json_uploaded": False, "md_uploaded": False, "teams_notified": False}

    token = _get_token()
    if not token:
        archive_result["error"] = "E5 credentials not configured — skipped archival"
        print("  [Archive] E5 credentials missing — 跳過歸檔")
        return archive_result

    # 上傳 JSON
    json_bytes = json.dumps(full_report, ensure_ascii=False, indent=2).encode("utf-8")
    json_ok = _upload_to_onedrive(token, f"healthcheck_{version_id}.json", json_bytes, "application/json")
    archive_result["json_uploaded"] = json_ok
    print(f"  [Archive] JSON {'✅' if json_ok else '❌'} → OneDrive/{ONEDRIVE_FOLDER}/healthcheck_{version_id}.json")

    # 上傳 MD
    md_bytes = report_md.encode("utf-8")
    md_ok = _upload_to_onedrive(token, f"healthcheck_{version_id}.md", md_bytes, "text/markdown")
    archive_result["md_uploaded"] = md_ok
    print(f"  [Archive] MD  {'✅' if md_ok else '❌'} → OneDrive/{ONEDRIVE_FOLDER}/healthcheck_{version_id}.md")

    # Teams 通知
    teams_ok = _send_teams_notification(token, version_id, full_report.get("summary", {}))
    archive_result["teams_notified"] = teams_ok
    print(f"  [Archive] Teams 通知 {'✅' if teams_ok else '❌'}")

    return archive_result
