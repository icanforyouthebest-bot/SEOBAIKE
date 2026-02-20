"""
AI Empire Self-Repair Orchestrator — AI 自主營運長
4 階段自我修復閉環：診斷 → 開工單 → 執行修復 → 驗證歸檔

Stage 1: 診斷（分析健康檢查報告，列出所有安全問題 + 難度 + 與上次比較）
Stage 2: 開工單（生成修復清單，按難度分級）
Stage 3: 執行修復（AI function calling: SQL修復/Cloudflare WAF/GitHub Issues/Azure唯讀）
Stage 4: 驗證歸檔（報告寫入 GitHub + 本地）

AI 引擎優先順序：XAI_API_KEY (Grok) → ANTHROPIC_API_KEY → rule-based

用法:
  python self_repair_orchestrator.py              # 全自動修復
  python self_repair_orchestrator.py --dry-run    # 只診斷，不執行
  python self_repair_orchestrator.py --cto-report # 生成完整營運長週報
"""
import os, sys, json, datetime, glob, base64, requests

# ─────────────────────────────────────────────────────────────
# Config from environment
# ─────────────────────────────────────────────────────────────
SUPABASE_URL          = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY          = os.environ.get("SUPABASE_SERVICE_ROLE_KEY",
                        os.environ.get("SUPABASE_KEY", ""))
SUPABASE_ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
SUPABASE_PROJECT_REF  = os.environ.get("SUPABASE_PROJECT_REF", "")
CF_API_TOKEN          = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CF_ACCOUNT_ID         = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
CF_ZONE_ID            = os.environ.get("CLOUDFLARE_ZONE_ID", "")
XAI_API_KEY           = os.environ.get("XAI_API_KEY", "")          # xAI Grok (優先)
ANTHROPIC_API_KEY     = os.environ.get("ANTHROPIC_API_KEY", "")    # Anthropic (備用)
GITHUB_TOKEN          = os.environ.get("GITHUB_TOKEN", os.environ.get("GITHUB_PAT", ""))
GITHUB_REPOSITORY     = os.environ.get("GITHUB_REPOSITORY", "icanforyouthebest-bot/SEOBAIKE")

# ─────────────────────────────────────────────────────────────
# AI engine detection: prefer XAI → Anthropic → rule-based
# ─────────────────────────────────────────────────────────────
AI_ENGINE = "none"
if XAI_API_KEY:
    AI_ENGINE = "xai"
elif ANTHROPIC_API_KEY:
    try:
        import anthropic as _anthropic_mod
        AI_ENGINE = "anthropic"
    except ImportError:
        pass

MGMT_BASE      = "https://api.supabase.com/v1"
CF_BASE        = "https://api.cloudflare.com/client/v4"
TRACKER_FILE   = "repairs_tracker.json"
KNOWLEDGE_BASE = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_base", "supabase_issues.md")

DRY_RUN    = "--dry-run" in sys.argv
CTO_REPORT = "--cto-report" in sys.argv

# ─────────────────────────────────────────────────────────────
# Tool definitions for Claude function calling
# ─────────────────────────────────────────────────────────────
TOOLS = [
    {
        "name": "execute_sql_on_supabase",
        "description": (
            "在 Supabase 資料庫執行 SQL（DDL/DML）。"
            "適合修復：SET search_path = '' 防注入、更新 RLS 政策、調整函數定義等。"
            "使用 Supabase Management API /projects/{ref}/database/query。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sql":         {"type": "string", "description": "要執行的 SQL 指令"},
                "description": {"type": "string", "description": "這條 SQL 修復的問題描述"},
                "issue_id":    {"type": "string", "description": "對應的問題 ID，如 SB-003"}
            },
            "required": ["sql", "description", "issue_id"]
        }
    },
    {
        "name": "fetch_supabase_lint",
        "description": "從 Supabase Management API 取得最新的資安掃描結果（lint），包含 function_search_path_mutable 等問題清單",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "set_cloudflare_ssl_strict",
        "description": "將 Cloudflare SSL/TLS 模式設為 Full (Strict)。修復 CF-003 弱 SSL 問題。",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "create_cloudflare_waf_rule",
        "description": "在 Cloudflare 建立 WAF/Firewall 規則保護 API 端點。修復 CF-004 無防護問題。",
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["block", "challenge", "js_challenge", "managed_challenge", "allow", "log"],
                    "description": "規則動作"
                },
                "expression":  {"type": "string", "description": "Cloudflare Firewall 規則運算式"},
                "description": {"type": "string", "description": "規則描述"},
                "issue_id":    {"type": "string", "description": "對應問題 ID"}
            },
            "required": ["action", "expression", "description", "issue_id"]
        }
    },
    {
        "name": "mark_repair",
        "description": "標記修復工單狀態，更新 repairs_tracker.json 進度表。每個修復動作後必須呼叫此工具。",
        "input_schema": {
            "type": "object",
            "properties": {
                "issue_id":    {"type": "string", "description": "問題 ID，如 SB-003、CF-003"},
                "desc":        {"type": "string", "description": "問題描述"},
                "fix_command": {"type": "string", "description": "執行的修復指令或說明"},
                "status":      {"type": "string", "enum": ["fixed", "partial", "skipped", "failed", "pending"]},
                "difficulty":  {"type": "string", "enum": ["low", "medium", "high"]},
                "note":        {"type": "string", "description": "備註（選填）"}
            },
            "required": ["issue_id", "desc", "fix_command", "status", "difficulty"]
        }
    },
    {
        "name": "github_create_issue",
        "description": (
            "在 GitHub 儲存庫建立 Issue，追蹤需要人工處理的高難度安全問題。"
            "用於 skipped/failed 的工單，確保不被遺漏。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title":     {"type": "string", "description": "Issue 標題"},
                "body":      {"type": "string", "description": "Issue 內容（Markdown）"},
                "labels":    {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Issue 標籤，如 ['security', 'manual-fix']"
                },
                "issue_id":  {"type": "string", "description": "對應問題 ID"}
            },
            "required": ["title", "body", "issue_id"]
        }
    },
    {
        "name": "azure_run_cli",
        "description": (
            "執行唯讀 Azure CLI 命令，取得 Azure 資源狀態資訊。"
            "只允許 az ... list / show / get 等唯讀操作。禁止 create/delete/update。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command":     {"type": "string", "description": "Azure CLI 命令（只允許唯讀操作）"},
                "description": {"type": "string", "description": "查詢目的說明"}
            },
            "required": ["command", "description"]
        }
    },
    {
        "name": "update_knowledge_base",
        "description": (
            "將本次修復的經驗、根因分析、成功/失敗案例追加到知識庫文件。"
            "每次修復完成後應呼叫此工具，確保知識庫持續成長。"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "section":   {"type": "string", "description": "知識庫章節名稱"},
                "content":   {"type": "string", "description": "要追加的 Markdown 內容"},
                "issue_ids": {"type": "array", "items": {"type": "string"}, "description": "相關問題 ID 清單"}
            },
            "required": ["section", "content"]
        }
    }
]

# ─────────────────────────────────────────────────────────────
# Tool implementations
# ─────────────────────────────────────────────────────────────

def _execute_sql_on_supabase(sql: str, description: str = "", issue_id: str = "") -> dict:
    if DRY_RUN:
        return {"success": True, "dry_run": True, "sql": sql[:200]}
    if not SUPABASE_ACCESS_TOKEN or not SUPABASE_PROJECT_REF:
        return {"success": False, "error": "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF"}
    headers = {
        "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    try:
        r = requests.post(
            f"{MGMT_BASE}/projects/{SUPABASE_PROJECT_REF}/database/query",
            headers=headers,
            json={"query": sql},
            timeout=30
        )
        if r.ok:
            return {"success": True, "result": r.json(), "sql_preview": sql[:200]}
        else:
            return {"success": False, "error": r.text[:300], "status_code": r.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _fetch_supabase_lint() -> dict:
    if not SUPABASE_ACCESS_TOKEN or not SUPABASE_PROJECT_REF:
        return {"success": False, "error": "Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF"}
    headers = {"Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}"}
    try:
        r = requests.get(
            f"{MGMT_BASE}/projects/{SUPABASE_PROJECT_REF}/database/lint",
            headers=headers,
            timeout=30
        )
        if r.ok:
            return {"success": True, "lint": r.json()}
        else:
            return {"success": False, "error": r.text[:300], "status_code": r.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _resolve_cf_zone_id() -> str:
    zone_id = CF_ZONE_ID
    if not zone_id and CF_API_TOKEN:
        r = requests.get(
            f"{CF_BASE}/zones?name=aiforseo.vip",
            headers={"Authorization": f"Bearer {CF_API_TOKEN}"},
            timeout=10
        )
        if r.ok and r.json().get("result"):
            zone_id = r.json()["result"][0]["id"]
    return zone_id


def _set_cloudflare_ssl_strict() -> dict:
    if DRY_RUN:
        return {"success": True, "dry_run": True, "action": "set_ssl_strict"}
    if not CF_API_TOKEN:
        return {"success": False, "error": "No CLOUDFLARE_API_TOKEN"}
    zone_id = _resolve_cf_zone_id()
    if not zone_id:
        return {"success": False, "error": "Cannot resolve Cloudflare zone ID"}
    r = requests.patch(
        f"{CF_BASE}/zones/{zone_id}/settings/ssl",
        headers={"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"},
        json={"value": "strict"},
        timeout=10
    )
    if r.ok:
        return {"success": True, "ssl_mode": "strict"}
    return {"success": False, "error": r.text[:200]}


def _create_cloudflare_waf_rule(action: str, expression: str, description: str, issue_id: str = "") -> dict:
    if DRY_RUN:
        return {"success": True, "dry_run": True, "action": action, "expression": expression}
    if not CF_API_TOKEN:
        return {"success": False, "error": "No CLOUDFLARE_API_TOKEN"}
    zone_id = _resolve_cf_zone_id()
    if not zone_id:
        return {"success": False, "error": "Cannot resolve Cloudflare zone ID"}
    headers = {"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"}
    # Create filter
    filter_r = requests.post(
        f"{CF_BASE}/zones/{zone_id}/filters",
        headers=headers,
        json=[{"expression": expression, "description": description}],
        timeout=10
    )
    if not filter_r.ok:
        return {"success": False, "error": f"Filter creation failed: {filter_r.text[:200]}"}
    filter_id = filter_r.json().get("result", [{}])[0].get("id")
    # Create rule
    rule_r = requests.post(
        f"{CF_BASE}/zones/{zone_id}/firewall/rules",
        headers=headers,
        json=[{"action": action, "filter": {"id": filter_id}, "description": description}],
        timeout=10
    )
    if rule_r.ok:
        return {"success": True, "rule_id": rule_r.json().get("result", [{}])[0].get("id")}
    return {"success": False, "error": rule_r.text[:200]}


def _load_tracker() -> list:
    if os.path.exists(TRACKER_FILE):
        try:
            with open(TRACKER_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return []


def _save_tracker(repairs: list):
    with open(TRACKER_FILE, "w", encoding="utf-8") as f:
        json.dump(repairs, f, ensure_ascii=False, indent=2)


def _mark_repair(issue_id: str, desc: str, fix_command: str, status: str,
                 difficulty: str, note: str = "") -> dict:
    repairs = _load_tracker()
    now = datetime.datetime.utcnow().isoformat()
    entry = {
        "issue_id":    issue_id,
        "desc":        desc,
        "fix_command": fix_command[:500],
        "status":      status,
        "difficulty":  difficulty,
        "note":        note,
        "updated_at":  now
    }
    # Update existing or append
    for i, r in enumerate(repairs):
        if r.get("issue_id") == issue_id:
            found_at = r.get("found_at", now)
            repairs[i] = {**entry, "found_at": found_at}
            _save_tracker(repairs)
            return repairs[i]
    entry["found_at"] = now
    repairs.append(entry)
    _save_tracker(repairs)
    return entry


def _update_knowledge_base(section: str, content: str, issue_ids: list = None) -> dict:
    """Append a new section to the knowledge base."""
    if DRY_RUN:
        return {"success": True, "dry_run": True, "section": section}
    try:
        with open(KNOWLEDGE_BASE, "a", encoding="utf-8") as f:
            f.write(f"\n\n---\n\n## {section}\n\n")
            f.write(f"_Updated: {datetime.datetime.utcnow().isoformat()}_\n\n")
            if issue_ids:
                f.write(f"**Related issues:** {', '.join(issue_ids)}\n\n")
            f.write(content)
        return {"success": True, "section": section}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _github_create_issue(title: str, body: str, labels: list = None, issue_id: str = "") -> dict:
    if DRY_RUN:
        return {"success": True, "dry_run": True, "title": title}
    if not GITHUB_TOKEN or not GITHUB_REPOSITORY:
        return {"success": False, "error": "Missing GITHUB_TOKEN or GITHUB_REPOSITORY"}
    headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    payload = {"title": title, "body": body}
    if labels:
        payload["labels"] = labels
    try:
        r = requests.post(
            f"https://api.github.com/repos/{GITHUB_REPOSITORY}/issues",
            headers=headers, json=payload, timeout=15
        )
        if r.ok:
            data = r.json()
            return {"success": True, "issue_number": data.get("number"), "url": data.get("html_url")}
        return {"success": False, "error": r.text[:200], "status_code": r.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Read-only Azure CLI command whitelist
_AZURE_ALLOWED_VERBS = {"list", "show", "get", "describe", "account"}

def _azure_run_cli(command: str, description: str = "") -> dict:
    if DRY_RUN:
        return {"success": True, "dry_run": True, "command": command}
    import subprocess
    # Safety check: only allow read-only verbs
    parts = command.strip().split()
    if len(parts) < 2 or parts[0] != "az":
        return {"success": False, "error": "Command must start with 'az'"}
    # Find the verb (e.g. 'list', 'show')
    verb = next((p for p in parts[1:] if not p.startswith("-")), "")
    if verb not in _AZURE_ALLOWED_VERBS:
        return {"success": False, "error": f"Verb '{verb}' not in allowed read-only list: {_AZURE_ALLOWED_VERBS}"}
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            try:
                out = json.loads(result.stdout)
            except Exception:
                out = result.stdout[:1000]
            return {"success": True, "result": out}
        return {"success": False, "error": result.stderr[:300]}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _dispatch_tool(tool_name: str, tool_input: dict) -> str:
    if tool_name == "execute_sql_on_supabase":
        result = _execute_sql_on_supabase(
            tool_input["sql"],
            tool_input.get("description", ""),
            tool_input.get("issue_id", "")
        )
    elif tool_name == "fetch_supabase_lint":
        result = _fetch_supabase_lint()
    elif tool_name == "set_cloudflare_ssl_strict":
        result = _set_cloudflare_ssl_strict()
    elif tool_name == "create_cloudflare_waf_rule":
        result = _create_cloudflare_waf_rule(
            tool_input["action"],
            tool_input["expression"],
            tool_input["description"],
            tool_input.get("issue_id", "")
        )
    elif tool_name == "mark_repair":
        result = _mark_repair(
            tool_input["issue_id"],
            tool_input["desc"],
            tool_input["fix_command"],
            tool_input["status"],
            tool_input["difficulty"],
            tool_input.get("note", "")
        )
    elif tool_name == "github_create_issue":
        result = _github_create_issue(
            tool_input["title"],
            tool_input["body"],
            tool_input.get("labels", ["security", "ai-empire-auto"]),
            tool_input.get("issue_id", "")
        )
    elif tool_name == "azure_run_cli":
        result = _azure_run_cli(
            tool_input["command"],
            tool_input.get("description", "")
        )
    elif tool_name == "update_knowledge_base":
        result = _update_knowledge_base(
            tool_input["section"],
            tool_input["content"],
            tool_input.get("issue_ids", [])
        )
    else:
        result = {"error": f"Unknown tool: {tool_name}"}
    return json.dumps(result, ensure_ascii=False)


# ─────────────────────────────────────────────────────────────
# Stage 1: Diagnose
# ─────────────────────────────────────────────────────────────

def _load_latest_report() -> dict | None:
    files = sorted(glob.glob("healthcheck_result_*.json"))
    if not files:
        files = sorted(glob.glob("reports/healthcheck_*.json"))
    if not files:
        return None
    with open(files[-1], encoding="utf-8") as f:
        return json.load(f)


def _load_all_reports() -> list:
    """Load all health check reports sorted by date."""
    files = sorted(glob.glob("healthcheck_result_*.json"))
    if not files:
        files = sorted(glob.glob("reports/healthcheck_*.json"))
    reports = []
    for f in files:
        try:
            with open(f, encoding="utf-8") as fp:
                reports.append(json.load(fp))
        except Exception:
            pass
    return reports


def _diagnose(report: dict) -> list:
    all_risks = []
    for module, data in report.get("modules", {}).items():
        for risk in data.get("risks", []):
            all_risks.append({**risk, "module": module})
    return all_risks


def _delta_analysis(current_report: dict, all_reports: list) -> dict:
    """Compare current report with previous one to find new/resolved issues."""
    if len(all_reports) < 2:
        return {"new_risks": [], "resolved_risks": [], "persisting_risks": []}

    prev = all_reports[-2]  # Second-to-last is the previous one
    cur_risks  = {r.get("id"): r for m, d in current_report.get("modules", {}).items()
                  for r in d.get("risks", [])}
    prev_risks = {r.get("id"): r for m, d in prev.get("modules", {}).items()
                  for r in d.get("risks", [])}

    new_risks       = [r for rid, r in cur_risks.items()  if rid not in prev_risks]
    resolved_risks  = [r for rid, r in prev_risks.items() if rid not in cur_risks]
    persisting_risks = [r for rid, r in cur_risks.items() if rid in prev_risks]

    return {
        "new_risks":        new_risks,
        "resolved_risks":   resolved_risks,
        "persisting_risks": persisting_risks,
        "prev_version_id":  prev.get("version_id", "unknown"),
    }


def _generate_cto_weekly_report(all_reports: list, tracker: list) -> str:
    """Generate a weekly CTO operations report."""
    if not all_reports:
        return "# AI Empire CTO Report\nNo data available."

    last = all_reports[-1]
    now  = datetime.datetime.utcnow()
    week_ago = now - datetime.timedelta(days=7)

    # Reports from the last 7 days
    recent = [r for r in all_reports
              if r.get("timestamp", "") >= week_ago.isoformat()]

    # Risk trend
    risk_counts = [(r.get("version_id",""), r.get("summary",{}).get("total_risks", 0))
                   for r in recent]

    fixed   = sum(1 for t in tracker if t["status"] == "fixed")
    pending = sum(1 for t in tracker if t["status"] in ("pending", "skipped"))

    lines = [
        "# AI Empire CTO Weekly Operations Report",
        f"**Generated:** {now.isoformat()}  ",
        f"**Period:** Last 7 days ({len(recent)} health checks)  ",
        "",
        "## Executive Summary",
        f"- Health checks run: {len(recent)}",
        f"- Current risk count: {last.get('summary',{}).get('total_risks', 0)}",
        f"- High risks: {len(last.get('summary',{}).get('high', []))}",
        f"- Auto-fixed this week: {fixed}",
        f"- Pending manual fix: {pending}",
        "",
        "## Risk Trend (recent → oldest)",
        "| Version | Total Risks |",
        "|---------|-------------|",
    ]
    for vid, count in reversed(risk_counts[-10:]):
        lines.append(f"| {vid} | {count} |")

    lines += [
        "",
        "## Repair Progress",
        "| Issue ID | Status | Difficulty | Description |",
        "|----------|--------|------------|-------------|",
    ]
    for t in sorted(tracker, key=lambda x: x.get("status", "")):
        lines.append(f"| {t['issue_id']} | {t['status']} | {t.get('difficulty','')} | {t['desc'][:60]} |")

    lines += [
        "",
        "## High Risk Pending Manual Action",
    ]
    high_pending = [t for t in tracker if t.get("difficulty") == "high"
                    and t["status"] in ("pending", "skipped")]
    if high_pending:
        for t in high_pending:
            lines.append(f"- **[{t['issue_id']}]** {t['desc']}")
            if t.get("note"):
                lines.append(f"  - {t['note']}")
    else:
        lines.append("- No high-risk items pending.")

    lines += [
        "",
        "## Infrastructure Status",
        f"- Supabase tables: {last.get('modules',{}).get('supabase',{}).get('tables_count', 'N/A')}",
        f"- Supabase functions: {last.get('modules',{}).get('supabase',{}).get('functions_count', 'N/A')}",
        f"- Cloudflare workers: {last.get('modules',{}).get('cloudflare',{}).get('workers_count', 'N/A')}",
        f"- GitHub repo: {GITHUB_REPOSITORY}",
        "",
        "---",
        "_Generated by AI Empire Self-Repair Orchestrator_",
    ]
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────
# Stage 2+3: AI-driven repair (xAI / Anthropic / rule-based)
# ─────────────────────────────────────────────────────────────

# Convert Anthropic-style tool schema to OpenAI-compatible format (used by xAI)
def _tools_to_openai_format() -> list:
    result = []
    for t in TOOLS:
        result.append({
            "type": "function",
            "function": {
                "name":        t["name"],
                "description": t["description"] if isinstance(t["description"], str) else str(t["description"]),
                "parameters":  t["input_schema"]
            }
        })
    return result


def _run_xai_repair(report: dict, risks: list) -> list:
    """Drive repair using xAI Grok API (OpenAI-compatible endpoint)."""
    import importlib
    # xAI uses OpenAI-compatible API
    try:
        openai = importlib.import_module("openai")
    except ImportError:
        print("  [xAI] openai package not installed — pip install openai")
        return _run_rule_based_repair(risks)

    client = openai.OpenAI(
        api_key=XAI_API_KEY,
        base_url="https://api.x.ai/v1"
    )

    # Load knowledge base
    kb_content = ""
    try:
        with open(KNOWLEDGE_BASE, encoding="utf-8") as f:
            kb_content = f.read()[:3000]
    except Exception:
        kb_content = "(knowledge base not found)"

    all_rpts = _load_all_reports()
    delta = _delta_analysis(report, all_rpts)
    supabase_info = {
        "project_ref":      SUPABASE_PROJECT_REF or "not_set",
        "has_access_token": bool(SUPABASE_ACCESS_TOKEN),
        "tables_count":     report.get("modules", {}).get("supabase", {}).get("tables_count", 0),
    }

    system_msg = f"""你是 AI Empire 的「自主營運長」（AI CTO）。你擁有對 Supabase、Cloudflare、GitHub、Azure 的操作工具。

## 知識庫（優先參考）
{kb_content}

---
修復策略：
- low 難度：立即呼叫工具修復
- medium 難度：謹慎評估，有把握才執行
- high 難度：不執行，呼叫 github_create_issue 建立追蹤工單

Supabase：function_search_path_mutable 先 fetch_supabase_lint，再批次 ALTER FUNCTION ... SET search_path = '';
Cloudflare：CF-003 直接 set_cloudflare_ssl_strict；CF-004 create_cloudflare_waf_rule
每個動作後必須呼叫 mark_repair 記錄。完成後呼叫 update_knowledge_base 追加本次經驗。

安全底線：禁止 DROP TABLE / TRUNCATE。Azure CLI 只允許唯讀。"""

    user_msg = f"""分析以下安全風險並執行修復：

## 風險（{len(risks)} 項）
{json.dumps(risks, ensure_ascii=False, indent=2)}

## Delta
新增: {len(delta['new_risks'])} 項

## 環境
Supabase: {json.dumps(supabase_info, ensure_ascii=False)}
Cloudflare Zone: {CF_ZONE_ID or 'not_set'}
dry_run: {DRY_RUN}"""

    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user",   "content": user_msg}
    ]
    tools_oai = _tools_to_openai_format()
    repair_log = []
    max_iterations = 30

    # xAI model priority: grok-4-0709 → grok-3 → grok-3-mini
    model_candidates = ["grok-4-0709", "grok-3", "grok-3-mini"]
    active_model = None  # cache successful model to skip retries

    for iteration in range(max_iterations):
        last_err = None
        response = None
        candidates = [active_model] if active_model else model_candidates
        for model_name in candidates:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    tools=tools_oai,
                    tool_choice="auto",
                    max_tokens=8192
                )
                if active_model is None:
                    active_model = model_name
                    print(f"  [xAI] Using model: {model_name}")
                break  # success
            except Exception as e:
                print(f"  [xAI] Model {model_name} failed: {type(e).__name__}: {str(e)[:120]}")
                last_err = e
                continue
        if response is None:
            print(f"  [xAI] All models failed: {last_err} — falling back to rule-based")
            return _run_rule_based_repair(risks)

        msg = response.choices[0].message

        # Print text
        if msg.content:
            for line in (msg.content or "").strip().split("\n")[:5]:
                print(f"  [Grok] {line}")

        finish_reason = response.choices[0].finish_reason
        print(f"  [xAI] iter={iteration} finish_reason={finish_reason} tool_calls={len(msg.tool_calls or [])}")

        # Handle stop without tool calls (Grok answered in text, no tools needed)
        if finish_reason == "stop" and not msg.tool_calls:
            break

        # Handle tool calls — finish_reason may be "tool_calls" or "stop" depending on model version
        if msg.tool_calls:
            tool_results_msgs = []
            for tc in msg.tool_calls:
                fn_name = tc.function.name
                try:
                    fn_input = json.loads(tc.function.arguments)
                except Exception:
                    fn_input = {}
                print(f"  [Tool] {fn_name}({json.dumps(fn_input, ensure_ascii=False)[:100]})")
                raw_result = _dispatch_tool(fn_name, fn_input)
                result_data = json.loads(raw_result)
                is_ok = result_data.get("success", True) if "success" in result_data else True
                print(f"  [Tool] -> {'OK' if is_ok else 'FAIL'}")
                repair_log.append({
                    "iteration": iteration, "tool": fn_name,
                    "input": fn_input, "result": result_data, "ok": is_ok
                })
                tool_results_msgs.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": raw_result
                })

            messages.append({"role": "assistant", "content": msg.content,
                             "tool_calls": [tc.model_dump() for tc in msg.tool_calls]})
            messages.extend(tool_results_msgs)
        else:
            break

    return repair_log


def _run_ai_repair(report: dict, risks: list) -> list:
    if AI_ENGINE == "none":
        print("  [AI Repair] No AI API key — using rule-based fallback")
        return _run_rule_based_repair(risks)

    if AI_ENGINE == "xai":
        print("  [AI Repair] Using xAI Grok API...")
        try:
            return _run_xai_repair(report, risks)
        except Exception as e:
            print(f"  [xAI] Fatal error: {e} — falling back to rule-based")
            return _run_rule_based_repair(risks)

    # Anthropic fallback
    print("  [AI Repair] Using Anthropic API...")
    import anthropic as _anthropic_mod
    client = _anthropic_mod.Anthropic(api_key=ANTHROPIC_API_KEY)

    supabase_info = {
        "project_ref":       SUPABASE_PROJECT_REF or "not_set",
        "has_access_token":  bool(SUPABASE_ACCESS_TOKEN),
        "has_service_key":   bool(SUPABASE_KEY),
        "tables_count":      report.get("modules", {}).get("supabase", {}).get("tables_count", 0),
        "functions_count":   report.get("modules", {}).get("supabase", {}).get("functions_count", 0),
    }

    # Load knowledge base for context
    kb_content = ""
    try:
        with open(KNOWLEDGE_BASE, encoding="utf-8") as f:
            kb_content = f.read()[:3000]  # First 3000 chars as context
    except Exception:
        kb_content = "(knowledge base not found)"

    system_prompt = f"""你是 AI Empire 的「自主營運長」（AI CTO）。你擁有對 Supabase、Cloudflare、GitHub、Azure 的操作工具。

## 知識庫（優先參考）
{kb_content}

---

你的核心使命：
1. 分析健康檢查報告，識別所有安全風險
2. 依難度自主執行修復（低/中難度直接修，高難度開 GitHub Issue）
3. 每個動作都留下完整記錄（mark_repair）
4. 不能自動修復的問題，必須建立 GitHub Issue 追蹤，確保零遺漏

修復分級策略：
- low 難度：立即呼叫工具修復
- medium 難度：謹慎評估，有把握才執行
- high 難度：不執行，呼叫 github_create_issue 建立追蹤工單

Supabase 修復：
1. function_search_path_mutable (medium)：
   - 先 fetch_supabase_lint 取得受影響函數清單
   - 批次執行：ALTER FUNCTION public.func_name() SET search_path = '';
   - 每個函數一條 SQL，逐一呼叫 execute_sql_on_supabase
2. rls_policy_always_true (medium)：評估政策，謹慎替換 (true) 為有意義條件
3. security_definer_view (high)：開 GitHub Issue，標記 skipped
4. extension_in_public (high)：開 GitHub Issue，標記 skipped
5. rls_enabled_no_policy (info)：INFO 等級，通常不需修復（預設阻止存取），標記 pending

Cloudflare 修復：
1. CF-003 SSL 弱模式 (low)：呼叫 set_cloudflare_ssl_strict
2. CF-004 無 WAF 規則 (low)：呼叫 create_cloudflare_waf_rule，建立 managed_challenge for threat_score > 30

對所有 high 難度 / skipped 問題，呼叫 github_create_issue 建立追蹤 Issue，附上：
- 問題描述和影響
- 建議修復步驟（手動操作指引）
- 標籤：['security', 'manual-fix', 'ai-empire-auto']

安全邊界（絕對禁止）：
- 禁止執行 DROP TABLE、DROP SCHEMA、TRUNCATE
- 禁止刪除 RLS 政策（只能新增或修改）
- Azure CLI 只允許唯讀操作（list/show/get）

每個修復動作後必須呼叫 mark_repair 記錄狀態。所有問題都要有記錄後才停止。"""

    # Load delta for context
    all_rpts = _load_all_reports()
    delta = _delta_analysis(report, all_rpts)

    user_message = f"""作為 AI Empire 自主營運長，請分析以下安全風險，並執行可自動修復的項目：

## 風險清單（{len(risks)} 項）
{json.dumps(risks, ensure_ascii=False, indent=2)}

## Delta 分析（與上次比較）
新增風險: {len(delta['new_risks'])} 項
{json.dumps(delta['new_risks'], ensure_ascii=False)}
已解決: {len(delta['resolved_risks'])} 項

## 環境狀態
Supabase: {json.dumps(supabase_info, ensure_ascii=False)}
Cloudflare Zone ID: {CF_ZONE_ID or 'not_set'}
GitHub Repo: {GITHUB_REPOSITORY}
dry_run: {DRY_RUN}

## 任務
1. 評估每個風險的修復難度（low/medium/high）
2. low/medium 難度：直接呼叫工具執行修復
3. high 難度：呼叫 github_create_issue 建立追蹤工單，附上修復指引
4. 所有項目都要 mark_repair 記錄最終狀態
5. 特別關注新增（delta）的風險，優先處理"""

    messages = [{"role": "user", "content": user_message}]
    repair_log = []
    max_iterations = 30

    for iteration in range(max_iterations):
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=8192,
            system=system_prompt,
            tools=TOOLS,
            messages=messages
        )

        # Print AI commentary
        for block in response.content:
            if hasattr(block, "text") and block.text.strip():
                for line in block.text.strip().split("\n")[:5]:
                    print(f"  [AI] {line}")

        if response.stop_reason == "end_turn":
            break

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    input_preview = json.dumps(block.input, ensure_ascii=False)[:120]
                    print(f"  [Tool] {block.name}({input_preview})")
                    raw_result = _dispatch_tool(block.name, block.input)
                    result_data = json.loads(raw_result)
                    is_ok = result_data.get("success", True) if "success" in result_data else True
                    print(f"  [Tool] -> {'OK' if is_ok else 'FAIL'}")
                    repair_log.append({
                        "iteration": iteration,
                        "tool":      block.name,
                        "input":     block.input,
                        "result":    result_data,
                        "ok":        is_ok
                    })
                    tool_results.append({
                        "type":        "tool_result",
                        "tool_use_id": block.id,
                        "content":     raw_result
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user",      "content": tool_results})
        else:
            break

    return repair_log


# ─────────────────────────────────────────────────────────────
# Fallback: Rule-based repair (no Anthropic API)
# ─────────────────────────────────────────────────────────────

def _run_rule_based_repair(risks: list) -> list:
    repair_log = []
    for risk in risks:
        rid   = risk.get("id", "")
        level = risk.get("level", "")
        desc  = risk.get("desc", "")

        if rid == "CF-003":
            print(f"  [Rule] {rid}: Setting Cloudflare SSL to Full Strict...")
            result = _set_cloudflare_ssl_strict()
            status = "fixed" if result.get("success") else "failed"
            _mark_repair(rid, desc, "set_cloudflare_ssl_strict()", status, "low",
                         result.get("error", "")[:100])
            repair_log.append({"tool": "set_cloudflare_ssl_strict", "result": result, "ok": result.get("success")})

        elif rid == "CF-004":
            print(f"  [Rule] {rid}: Creating basic WAF threat-score rule...")
            result = _create_cloudflare_waf_rule(
                action="managed_challenge",
                expression="(cf.threat_score gt 30)",
                description="Block high threat score (auto by AI Empire Health Check)",
                issue_id=rid
            )
            status = "fixed" if result.get("success") else "failed"
            _mark_repair(rid, desc, "create_cloudflare_waf_rule(managed_challenge, threat_score>30)",
                         status, "low", result.get("error", "")[:100])
            repair_log.append({"tool": "create_cloudflare_waf_rule", "result": result, "ok": result.get("success")})

        else:
            # Mark high-difficulty or unknown issues as pending
            difficulty = "high" if level == "high" else "medium"
            _mark_repair(rid, desc, "manual_review_required", "pending", difficulty)

    return repair_log


# ─────────────────────────────────────────────────────────────
# Stage 4: Generate report & archive
# ─────────────────────────────────────────────────────────────

def _generate_report_md(version_id: str, risks: list, repair_log: list, tracker: list) -> str:
    fixed   = sum(1 for t in tracker if t["status"] == "fixed")
    skipped = sum(1 for t in tracker if t["status"] == "skipped")
    pending = sum(1 for t in tracker if t["status"] == "pending")
    failed  = sum(1 for t in tracker if t["status"] == "failed")

    lines = [
        "# AI Empire Self-Repair Report",
        f"**Version:** {version_id}  ",
        f"**Time:** {datetime.datetime.utcnow().isoformat()}  ",
        f"**Mode:** {'DRY-RUN' if DRY_RUN else 'LIVE'}  ",
        "",
        "## Summary",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Total Risks | {len(risks)} |",
        f"| Fixed | {fixed} |",
        f"| Skipped (manual) | {skipped} |",
        f"| Pending | {pending} |",
        f"| Failed | {failed} |",
        f"| Tool Calls | {len(repair_log)} |",
        "",
        "## Repair Progress Table",
        "| Issue ID | Description | Difficulty | Status | Fix Command | Updated |",
        "|----------|-------------|------------|--------|-------------|---------|",
    ]
    for t in tracker:
        lines.append(
            f"| {t['issue_id']} "
            f"| {t['desc'][:50]} "
            f"| {t.get('difficulty','')} "
            f"| {t['status']} "
            f"| `{t['fix_command'][:40]}` "
            f"| {t.get('updated_at','')[:16]} |"
        )

    lines += [
        "",
        "## High Risk Items Still Pending",
    ]
    for t in tracker:
        if t.get("difficulty") == "high" and t["status"] in ("pending", "skipped"):
            lines.append(f"- **[{t['issue_id']}]** {t['desc']} — _{t.get('note','手動處理')}_")

    lines += [
        "",
        "## Tool Execution Log",
    ]
    for log in repair_log:
        ok_str = "OK" if log.get("ok") else "FAIL"
        input_str = json.dumps(log.get("input", {}), ensure_ascii=False)[:80]
        lines.append(f"- [{ok_str}] `{log['tool']}({input_str}...)`")

    return "\n".join(lines)


def _archive_to_github(version_id: str, content_json: dict, content_md: str) -> bool:
    if not GITHUB_TOKEN or not GITHUB_REPOSITORY:
        return False
    headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}

    def _upload(path, content_bytes):
        encoded = base64.b64encode(content_bytes).decode()
        check_r = requests.get(
            f"https://api.github.com/repos/{GITHUB_REPOSITORY}/contents/{path}", headers=headers)
        payload = {
            "message": f"chore: self-repair report {version_id} [skip ci]",
            "content": encoded, "branch": "master"
        }
        if check_r.ok:
            payload["sha"] = check_r.json().get("sha")
        r = requests.put(
            f"https://api.github.com/repos/{GITHUB_REPOSITORY}/contents/{path}",
            headers=headers, json=payload, timeout=20)
        return r.status_code in (200, 201)

    base = f"scripts/health-check/reports"
    ok1 = _upload(f"{base}/repair_{version_id}.json",
                  json.dumps(content_json, ensure_ascii=False, indent=2).encode())
    ok2 = _upload(f"{base}/repair_{version_id}.md", content_md.encode())
    return ok1 or ok2


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────

def run():
    version_id = datetime.datetime.utcnow().strftime("%Y-%m-%d-%H-%M")
    mode_str = " [DRY-RUN]" if DRY_RUN else ""
    print(f"\n{'='*60}")
    print(f"  AI Empire Self-Repair Orchestrator  v{version_id}{mode_str}")
    print(f"{'='*60}\n")

    # ── Stage 1: Diagnose ────────────────────────────────────
    print("[ Stage 1/4 ] Diagnosing from latest health check report...")
    all_reports = _load_all_reports()
    report = all_reports[-1] if all_reports else None
    if not report:
        print("[ERROR] No health check report found.")
        print("        Run healthcheck_orchestrator.py first, then re-run this script.")
        return

    print(f"  Loaded: {report.get('version_id', 'unknown')}  ({len(all_reports)} reports total)")
    risks = _diagnose(report)
    high   = [r for r in risks if r.get("level") == "high"]
    medium = [r for r in risks if r.get("level") == "medium"]
    low    = [r for r in risks if r.get("level") == "low"]
    print(f"  Risks: {len(risks)} total  ({len(high)} high, {len(medium)} medium, {len(low)} low)")
    for r in high:
        print(f"  [HIGH] [{r.get('module','?').upper()}] {r.get('id','?')} — {r.get('desc','')}")

    # Delta analysis
    delta = _delta_analysis(report, all_reports)
    if delta["new_risks"]:
        print(f"  [NEW since {delta['prev_version_id']}] {len(delta['new_risks'])} new risks:")
        for r in delta["new_risks"]:
            print(f"    + {r.get('id','?')} [{r.get('level','?')}] {r.get('desc','')}")
    if delta["resolved_risks"]:
        print(f"  [RESOLVED] {len(delta['resolved_risks'])} risks resolved since last check")

    # CTO weekly report mode
    if CTO_REPORT:
        print("\n[ CTO Report Mode ] Generating weekly operations report...")
        tracker = _load_tracker()
        weekly_md = _generate_cto_weekly_report(all_reports, tracker)
        cto_file = f"cto_weekly_{version_id}.md"
        with open(cto_file, "w", encoding="utf-8") as f:
            f.write(weekly_md)
        print(f"  Saved: {cto_file}")
        gh_ok = _archive_to_github(version_id, {}, weekly_md)
        print(f"  GitHub archive: {'OK' if gh_ok else 'FAIL'}")
        return {"mode": "cto_report", "file": cto_file}

    # ── Stage 2: Generate repair plan (printed) ───────────────
    print("\n[ Stage 2/4 ] Generating repair plan...")
    print("  Difficulty assessment:")
    difficulty_map = {
        "CF-003": ("low",    "Cloudflare API PATCH /settings/ssl"),
        "CF-004": ("low",    "Cloudflare API POST /firewall/rules"),
        "SB-001": ("low",    "Check Supabase REST API connectivity"),
        "SB-003": ("medium", "Supabase Auth config update"),
        "SB-004": ("medium", "Verify RLS is enabled on table"),
        "SB-005": ("medium", "Make storage bucket private"),
        "GH-001": ("high",   "Repo visibility change — manual only"),
        "GH-002": ("medium", "GitHub branch protection API"),
        "GH-003": ("low",    "Mark secrets as documented"),
    }
    for risk in risks:
        rid = risk.get("id", "?")
        diff, method = difficulty_map.get(rid, ("high", "manual review required"))
        print(f"  {rid}: {diff.upper()} — {method}")

    # ── Stage 3: Execute repairs ─────────────────────────────
    print(f"\n[ Stage 3/4 ] Executing repairs (Claude AI{'  [DRY-RUN]' if DRY_RUN else ''})...")
    repair_log = _run_ai_repair(report, risks)
    print(f"  Tool calls executed: {len(repair_log)}")
    ok_count = sum(1 for log in repair_log if log.get("ok"))
    print(f"  Successful: {ok_count}/{len(repair_log)}")

    # ── Stage 4: Verify & Archive ────────────────────────────
    print("\n[ Stage 4/4 ] Generating report and archiving...")
    tracker = _load_tracker()
    report_md = _generate_report_md(version_id, risks, repair_log, tracker)

    # Write local files
    local_json = f"repair_result_{version_id}.json"
    local_md   = f"repair_report_{version_id}.md"
    repair_summary = {
        "version_id":  version_id,
        "timestamp":   datetime.datetime.utcnow().isoformat(),
        "dry_run":     DRY_RUN,
        "total_risks": len(risks),
        "repair_log":  repair_log,
        "tracker":     tracker,
    }
    with open(local_json, "w", encoding="utf-8") as f:
        json.dump(repair_summary, f, ensure_ascii=False, indent=2)
    with open(local_md, "w", encoding="utf-8") as f:
        f.write(report_md)
    print(f"  [1/2] Local files: OK ({local_json}, {local_md})")

    # Archive to GitHub
    gh_ok = _archive_to_github(version_id, repair_summary, report_md)
    print(f"  [2/2] GitHub: {'OK' if gh_ok else 'FAIL (check GITHUB_TOKEN)'}")

    # Final summary
    fixed   = sum(1 for t in tracker if t["status"] == "fixed")
    skipped = sum(1 for t in tracker if t["status"] == "skipped")
    pending = sum(1 for t in tracker if t["status"] == "pending")
    failed  = sum(1 for t in tracker if t["status"] == "failed")

    print(f"\n{'='*60}")
    print(f"  Self-Repair Done  v{version_id}{mode_str}")
    print(f"  Fixed:   {fixed}")
    print(f"  Skipped: {skipped}  (needs manual)")
    print(f"  Pending: {pending}")
    print(f"  Failed:  {failed}")
    print(f"{'='*60}\n")

    return repair_summary


if __name__ == "__main__":
    run()
