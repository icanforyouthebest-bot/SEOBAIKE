"""
AI Empire Health Check — 總控模組
全身健康檢查：Azure + E5/Entra + Cloudflare + Supabase + GitHub
流程：全部掃完 → 彙整 → 歸檔到 5 個地方
"""
import os, json, datetime, base64, requests
from check_azure import check_azure
from check_entra_e5 import check_entra_e5
from check_cloudflare import check_cloudflare
from check_supabase import check_supabase
from check_github import check_github
from archive_to_e5 import archive_results

def run():
    version_id = datetime.datetime.utcnow().strftime("%Y-%m-%d-%H-%M")
    print(f"\n{'='*60}")
    print(f"  AI Empire Health Check  v{version_id}")
    print(f"{'='*60}\n")

    results = {}

    # ── 1. Azure ──────────────────────────────────────────────
    print("[ 1/5 ] Azure 健康檢查...")
    results["azure"] = check_azure()

    # ── 2. E5 / Entra ─────────────────────────────────────────
    print("[ 2/5 ] E5 / Entra 健康檢查...")
    results["entra_e5"] = check_entra_e5()

    # ── 3. Cloudflare ─────────────────────────────────────────
    print("[ 3/5 ] Cloudflare 健康檢查...")
    results["cloudflare"] = check_cloudflare()

    # ── 4. Supabase ───────────────────────────────────────────
    print("[ 4/5 ] Supabase 健康檢查...")
    results["supabase"] = check_supabase()

    # ── 5. GitHub ─────────────────────────────────────────────
    print("[ 5/5 ] GitHub 健康檢查...")
    results["github"] = check_github()

    # ── 彙整完整報告 ───────────────────────────────────────────
    full_report = {
        "version_id": version_id,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "modules": results,
        "summary": _generate_summary(results),
    }

    # 寫入本地檔案
    with open(f"healthcheck_result_{version_id}.json", "w", encoding="utf-8") as f:
        json.dump(full_report, f, ensure_ascii=False, indent=2)

    report_md = _generate_markdown(full_report)
    with open(f"healthcheck_report_{version_id}.md", "w", encoding="utf-8") as f:
        f.write(report_md)

    # ── 歸檔到 5 個地方 ────────────────────────────────────────
    print("\n[ Archive ] 歸檔到 5 個平台...")
    archive_status = {}

    # 1. 本地 JSON/MD (已完成)
    archive_status["local"] = "ok"
    print("  [1/5] Local files: OK")

    # 2. E5 SharePoint / OneDrive
    print("  [2/5] E5 OneDrive...")
    try:
        e5_result = archive_results(version_id, full_report, report_md)
        e5_ok = e5_result.get("json_uploaded") or e5_result.get("md_uploaded")
        archive_status["e5"] = "ok" if e5_ok else "fail"
        print(f"       -> {'OK' if e5_ok else 'FAIL (SharePoint not provisioned)'}")
    except Exception as ex:
        archive_status["e5"] = f"error: {str(ex)[:50]}"
        print(f"       -> ERROR: {ex}")

    # 3. Supabase configs table
    print("  [3/5] Supabase...")
    try:
        sb_ok = _archive_to_supabase(version_id, full_report)
        archive_status["supabase"] = "ok" if sb_ok else "fail"
        print(f"       -> {'OK' if sb_ok else 'FAIL'}")
    except Exception as ex:
        archive_status["supabase"] = f"error: {str(ex)[:50]}"
        print(f"       -> ERROR: {ex}")

    # 4. GitHub (commit result file)
    print("  [4/5] GitHub...")
    try:
        gh_ok = _archive_to_github(version_id, full_report)
        archive_status["github"] = "ok" if gh_ok else "fail"
        print(f"       -> {'OK' if gh_ok else 'FAIL'}")
    except Exception as ex:
        archive_status["github"] = f"error: {str(ex)[:50]}"
        print(f"       -> ERROR: {ex}")

    # 5. Cloudflare KV
    print("  [5/5] Cloudflare KV...")
    try:
        cf_ok = _archive_to_cloudflare(version_id, full_report)
        archive_status["cloudflare"] = "ok" if cf_ok else "fail"
        print(f"       -> {'OK' if cf_ok else 'FAIL'}")
    except Exception as ex:
        archive_status["cloudflare"] = f"error: {str(ex)[:50]}"
        print(f"       -> ERROR: {ex}")

    full_report["archive_status"] = archive_status
    # 更新本地 JSON 加入歸檔狀態
    with open(f"healthcheck_result_{version_id}.json", "w", encoding="utf-8") as f:
        json.dump(full_report, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"  Health Check Done  v{version_id}")
    total_risks = sum(len(r.get("risks", [])) for r in results.values())
    high_risks = sum(1 for r in results.values() for x in r.get("risks", []) if x.get("level") == "high")
    print(f"  Risks: {total_risks}  High: {high_risks}")
    ok_count = sum(1 for v in archive_status.values() if v == "ok")
    print(f"  Archive: {ok_count}/5 platforms OK")
    for dest, status in archive_status.items():
        print(f"    {dest}: {status}")
    print(f"{'='*60}\n")
    return full_report


def _archive_to_supabase(version_id: str, full_report: dict) -> bool:
    url = os.environ.get("SUPABASE_URL", "")
    # Try service_role key first, then anon key as fallback
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
           or os.environ.get("SUPABASE_SERVICE_ROLE")
           or os.environ.get("SUPABASE_KEY", ""))
    if not url or not key or key.startswith("<"):
        return False
    r = requests.post(
        f"{url}/rest/v1/configs",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"},
        json={"key": f"healthcheck_{version_id}", "value": json.dumps(full_report, ensure_ascii=False)},
        timeout=15
    )
    return r.status_code in (200, 201)


def _archive_to_github(version_id: str, full_report: dict) -> bool:
    token = os.environ.get("GITHUB_TOKEN", os.environ.get("GITHUB_PAT", ""))
    repo = os.environ.get("GITHUB_REPOSITORY", "icanforyouthebest-bot/SEOBAIKE")
    if not token or not repo:
        return False
    path = f"scripts/health-check/reports/healthcheck_{version_id}.json"
    content = base64.b64encode(json.dumps(full_report, ensure_ascii=False, indent=2).encode()).decode()
    # Check if file exists (get SHA)
    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
    check_r = requests.get(f"https://api.github.com/repos/{repo}/contents/{path}", headers=headers)
    payload = {
        "message": f"chore: health check report {version_id} [skip ci]",
        "content": content,
        "branch": "master"
    }
    if check_r.ok:
        payload["sha"] = check_r.json().get("sha")
    r = requests.put(f"https://api.github.com/repos/{repo}/contents/{path}", headers=headers, json=payload, timeout=20)
    return r.status_code in (200, 201)


def _archive_to_cloudflare(version_id: str, full_report: dict) -> bool:
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    if not token or not account_id:
        return False
    # List KV namespaces to find one for health check data
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces", headers=headers, timeout=10)
    if not r.ok:
        return False
    namespaces = r.json().get("result", [])
    # Use RATE_LIMIT or first available namespace
    ns_id = None
    for ns in namespaces:
        if "RATE_LIMIT" in ns.get("title", ""):
            ns_id = ns.get("id")
            break
    if not ns_id and namespaces:
        ns_id = namespaces[0].get("id")
    if not ns_id:
        return False
    key = f"healthcheck_{version_id}"
    value = json.dumps(full_report, ensure_ascii=False)
    r2 = requests.put(
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{ns_id}/values/{key}",
        headers={**headers, "Content-Type": "application/json"},
        data=value.encode("utf-8"),
        timeout=15
    )
    return r2.ok


def _generate_summary(results: dict) -> dict:
    all_risks = []
    for module, data in results.items():
        for risk in data.get("risks", []):
            risk["module"] = module
            all_risks.append(risk)
    return {
        "total_risks": len(all_risks),
        "high": [r for r in all_risks if r.get("level") == "high"],
        "medium": [r for r in all_risks if r.get("level") == "medium"],
        "low": [r for r in all_risks if r.get("level") == "low"],
        "modules_checked": list(results.keys()),
    }


def _generate_markdown(report: dict) -> str:
    lines = [
        f"# AI Empire Health Check Report",
        f"**Version:** {report['version_id']}  ",
        f"**Time:** {report['timestamp']}  ",
        "",
        "## Summary",
        f"- Total Risks: {report['summary']['total_risks']}",
        f"- High: {len(report['summary']['high'])}",
        f"- Medium: {len(report['summary']['medium'])}",
        f"- Low: {len(report['summary']['low'])}",
        "",
        "## High Risk Items",
    ]
    for r in report["summary"]["high"]:
        lines.append(f"- **[{r['module']}]** `{r.get('id', '?')}` — {r.get('desc', '')}")
    for module, data in report["modules"].items():
        lines += [f"\n## {module.upper()}", f"Status: {data.get('status', 'unknown')}"]
        for risk in data.get("risks", []):
            lines.append(f"- [{risk.get('level','?').upper()}] {risk.get('desc','')}")
    return "\n".join(lines)


if __name__ == "__main__":
    run()
