"""
AI Empire Health Check — GitHub 模組
掃描：Repo 設定、Secrets 缺漏、Actions 狀態、Branch Protection、Dependabot
API: GitHub REST API v3
"""
import os, requests

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", os.environ.get("GH_TOKEN", ""))
GITHUB_REPO = os.environ.get("GITHUB_REPOSITORY", "icanf76/seobaike")
GH_BASE = "https://api.github.com"

# 必須設定的 Secrets（如果缺少則風險）
REQUIRED_SECRETS = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "TENANT_ID",
    "CLIENT_ID",
    "CLIENT_SECRET",
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "SUPABASE_PROJECT_REF",
    "SUPABASE_ACCESS_TOKEN",
    "AZURE_CREDENTIALS",
]


def check_github() -> dict:
    result = {"status": "ok", "repo": {}, "actions": [], "secrets": {}, "risks": []}
    if not GITHUB_TOKEN:
        result["status"] = "skipped"
        result["risks"].append({"id": "GH-000", "level": "medium", "desc": "GitHub token not configured"})
        return result

    h = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github+json"}
    owner, repo = GITHUB_REPO.split("/") if "/" in GITHUB_REPO else ("icanf76", "seobaike")

    # ── 1. Repo 基本資訊 ──────────────────────────────────────
    try:
        r = requests.get(f"{GH_BASE}/repos/{owner}/{repo}", headers=h)
        if r.ok:
            info = r.json()
            result["repo"] = {
                "name": info.get("name"),
                "private": info.get("private"),
                "default_branch": info.get("default_branch"),
                "open_issues": info.get("open_issues_count"),
            }
            if not info.get("private"):
                result["risks"].append({"id": "GH-001", "level": "high", "desc": "Repo 為 Public（原始碼公開）"})
        else:
            result["risks"].append({"id": "GH-001e", "level": "high", "desc": f"GitHub repo 無法存取: {r.status_code}"})
    except Exception as e:
        result["risks"].append({"id": "GH-001e", "level": "low", "desc": f"Repo scan error: {e}"})

    # ── 2. Branch Protection ──────────────────────────────────
    try:
        default_branch = result["repo"].get("default_branch", "master")
        r = requests.get(f"{GH_BASE}/repos/{owner}/{repo}/branches/{default_branch}/protection", headers=h)
        if r.status_code == 404:
            result["risks"].append({
                "id": "GH-002", "level": "high",
                "desc": f"主分支 '{default_branch}' 沒有啟用 Branch Protection"
            })
        elif r.ok:
            protection = r.json()
            result["security_branch_protected"] = True
            if not protection.get("required_pull_request_reviews"):
                result["risks"].append({"id": "GH-002b", "level": "medium", "desc": "主分支未要求 PR Review"})
    except Exception:
        pass

    # ── 3. Actions 最近執行狀態 ───────────────────────────────
    try:
        r = requests.get(f"{GH_BASE}/repos/{owner}/{repo}/actions/runs?per_page=10", headers=h)
        if r.ok:
            runs = r.json().get("workflow_runs", [])
            result["actions_recent_count"] = len(runs)
            failed = [run for run in runs if run.get("conclusion") == "failure"]
            if failed:
                result["risks"].append({
                    "id": "GH-003", "level": "medium",
                    "desc": f"最近 {len(failed)} 個 Actions 執行失敗"
                })
            # 最後一次執行狀態
            if runs:
                last = runs[0]
                result["last_action"] = {
                    "name": last.get("name"),
                    "status": last.get("status"),
                    "conclusion": last.get("conclusion"),
                    "created_at": last.get("created_at"),
                }
    except Exception:
        pass

    # ── 4. Secrets 清單（只能看名稱，不能看值）────────────────
    try:
        r = requests.get(f"{GH_BASE}/repos/{owner}/{repo}/actions/secrets", headers=h)
        if r.ok:
            secrets = r.json().get("secrets", [])
            secret_names = {s.get("name") for s in secrets}
            result["secrets"]["configured_count"] = len(secrets)
            result["secrets"]["names"] = list(secret_names)

            # 檢查必要 secrets 是否都設定
            missing = [s for s in REQUIRED_SECRETS if s not in secret_names]
            if missing:
                result["risks"].append({
                    "id": "GH-004", "level": "high",
                    "desc": f"缺少必要 Secrets: {', '.join(missing)}"
                })
    except Exception:
        pass

    # ── 5. Dependabot 狀態 ────────────────────────────────────
    try:
        r = requests.get(f"{GH_BASE}/repos/{owner}/{repo}/vulnerability-alerts", headers=h)
        if r.status_code == 204:
            result["security"]["dependabot"] = "enabled"
        elif r.status_code == 404:
            result["security"]["dependabot"] = "disabled"
            result["risks"].append({"id": "GH-005", "level": "low", "desc": "Dependabot 安全掃描未啟用"})
    except Exception:
        pass

    # ── 6. Workflows 清單 ─────────────────────────────────────
    try:
        r = requests.get(f"{GH_BASE}/repos/{owner}/{repo}/actions/workflows", headers=h)
        if r.ok:
            workflows = r.json().get("workflows", [])
            result["workflows"] = [w.get("name") for w in workflows]
            result["workflows_count"] = len(workflows)
    except Exception:
        pass

    return result
