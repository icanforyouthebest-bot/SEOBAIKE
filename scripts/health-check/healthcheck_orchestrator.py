"""
AI Empire Health Check — 總控模組
全身健康檢查：Azure + E5/Entra + Cloudflare + Supabase + GitHub
流程：全部掃完 → 彙整 → 歸檔到 E5
"""
import os, json, datetime
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

    # ── 歸檔到 E5 ─────────────────────────────────────────────
    print("\n[ 歸檔 ] 上傳到 E5 SharePoint...")
    archive_results(version_id, full_report, report_md)

    print(f"\n{'='*60}")
    print(f"  Health Check 完成  v{version_id}")
    total_risks = sum(len(r.get("risks", [])) for r in results.values())
    high_risks = sum(1 for r in results.values() for x in r.get("risks", []) if x.get("level") == "high")
    print(f"  總風險: {total_risks}  高風險: {high_risks}")
    print(f"{'='*60}\n")
    return full_report


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
