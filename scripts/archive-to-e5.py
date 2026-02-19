"""
AI Empire — E5 Graph API 自動歸檔
每次 GitHub Actions 部署後自動執行
把部署紀錄、Log、稽核資料歸檔到 SharePoint
"""
import os
import json
import datetime
import requests
from msal import ConfidentialClientApplication

# ── 設定 ──────────────────────────────────────────
TENANT_ID     = os.environ.get("TENANT_ID", "c1e1278e-c05c-4d00-a4c9-93fbbea01346")
CLIENT_ID     = os.environ.get("CLIENT_ID", "9dc16b16-952d-4190-b626-692c26f9262e")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET", "")
AUTHORITY     = f"https://login.microsoftonline.com/{TENANT_ID}"
SCOPES        = ["https://graph.microsoft.com/.default"]
GRAPH_URL     = "https://graph.microsoft.com/v1.0"

# 部署資訊
COMMIT_SHA     = os.environ.get("GITHUB_SHA", "unknown")[:8]
ACTOR          = os.environ.get("GITHUB_ACTOR", "system")
REPOSITORY     = os.environ.get("GITHUB_REPOSITORY", "SEOBAIKE")
DEPLOY_TIME    = os.environ.get("DEPLOY_TIME", datetime.datetime.utcnow().isoformat())
COMMIT_MESSAGE = os.environ.get("COMMIT_MESSAGE", "")


def get_token() -> str:
    app = ConfidentialClientApplication(
        CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET
    )
    result = app.acquire_token_for_client(scopes=SCOPES)
    if "access_token" not in result:
        raise RuntimeError(f"Token 取得失敗: {result.get('error_description')}")
    return result["access_token"]


def get_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def archive_to_onedrive(token: str, filename: str, content: str) -> bool:
    """上傳檔案到 OneDrive SEOBAIKE/deployments/ 資料夾"""
    headers = get_headers(token)
    headers["Content-Type"] = "text/plain; charset=utf-8"
    upload_url = f"{GRAPH_URL}/users/{ACTOR}@AIEmpire.onmicrosoft.com/drive/root:/SEOBAIKE/deployments/{filename}:/content"
    r = requests.put(upload_url, headers=headers, data=content.encode("utf-8"))
    if r.status_code in (200, 201):
        print(f"✅ 歸檔成功: {filename}")
        return True
    # fallback: 用管理員帳戶
    upload_url2 = f"{GRAPH_URL}/users/HsuChunHsiang@AIEmpire.onmicrosoft.com/drive/root:/SEOBAIKE/deployments/{filename}:/content"
    r2 = requests.put(upload_url2, headers=headers, data=content.encode("utf-8"))
    if r2.status_code in (200, 201):
        print(f"✅ 歸檔成功(管理員): {filename}")
        return True
    print(f"⚠️ 歸檔失敗 {r2.status_code}: {r2.text[:200]}")
    return False


def post_teams_notification(token: str, message: str) -> bool:
    """發送部署通知到 Teams"""
    headers = get_headers(token)
    # 找到 AI Empire 的第一個 Team
    r = requests.get(f"{GRAPH_URL}/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')&$select=id,displayName", headers=headers)
    if r.status_code != 200:
        return False
    groups = r.json().get("value", [])
    if not groups:
        return False
    team_id = groups[0]["id"]
    # 找 General channel
    r2 = requests.get(f"{GRAPH_URL}/teams/{team_id}/channels?$filter=displayName eq 'General'", headers=headers)
    if r2.status_code != 200:
        return False
    channels = r2.json().get("value", [])
    if not channels:
        return False
    channel_id = channels[0]["id"]
    # 發訊息
    body = {
        "body": {
            "contentType": "html",
            "content": message
        }
    }
    r3 = requests.post(f"{GRAPH_URL}/teams/{team_id}/channels/{channel_id}/messages", headers=headers, json=body)
    if r3.status_code in (200, 201):
        print("✅ Teams 通知發送成功")
        return True
    return False


def main():
    print("AI Empire — E5 Archive start")
    if not CLIENT_SECRET:
        print("[Archive] SKIP: CLIENT_SECRET not configured in GitHub Secrets")
        print(f"[Archive] Deploy info: {COMMIT_SHA} by {ACTOR} @ {DEPLOY_TIME}")
        return
    token = get_token()
    print(f"Token OK")

    now = datetime.datetime.utcnow().strftime("%Y%m%d-%H%M%S")

    # ── 1. 部署紀錄 ──
    deploy_record = {
        "timestamp": DEPLOY_TIME,
        "commit": COMMIT_SHA,
        "actor": ACTOR,
        "repository": REPOSITORY,
        "message": COMMIT_MESSAGE,
        "status": "deployed",
        "platform": "Cloudflare Workers + Azure Functions",
        "version": f"seobaike-{now}"
    }
    deploy_json = json.dumps(deploy_record, ensure_ascii=False, indent=2)
    archive_to_onedrive(token, f"deploy-{now}-{COMMIT_SHA}.json", deploy_json)

    # ── 2. 稽核 Log ──
    audit_log = f"""AI Empire 部署稽核紀錄
=============================
時間: {DEPLOY_TIME}
提交: {COMMIT_SHA}
執行者: {ACTOR}
Repository: {REPOSITORY}
訊息: {COMMIT_MESSAGE}
狀態: 成功
平台: Cloudflare Workers v4 + Azure Functions
=============================
"""
    archive_to_onedrive(token, f"audit-{now}.txt", audit_log)

    # ── 3. Teams 通知 ──
    teams_msg = f"""
<b>🚀 SEOBAIKE 部署完成</b><br>
<b>時間：</b>{DEPLOY_TIME}<br>
<b>提交：</b>{COMMIT_SHA}<br>
<b>執行者：</b>{ACTOR}<br>
<b>訊息：</b>{COMMIT_MESSAGE}<br>
<b>網址：</b><a href="https://aiforseo.vip">aiforseo.vip</a>
"""
    post_teams_notification(token, teams_msg)

    print("✅ AI Empire 歸檔完成")


if __name__ == "__main__":
    main()
