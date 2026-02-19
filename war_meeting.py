import urllib.request, json, time, uuid
from datetime import datetime, timezone

import os, subprocess
SR = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SR:
    try:
        SR = subprocess.check_output("az keyvault secret show --vault-name seobaike-vault --name supabase-service-key --query value -o tsv", shell=True).decode().strip()
    except Exception:
        raise RuntimeError("No service key found. Set SUPABASE_SERVICE_KEY or configure Key Vault.")
BASE = "https://vmyrivxxibqydccurxug.supabase.co/rest/v1"
ROUTER = "https://seobaike-ai-router.azurewebsites.net/api/route"
headers = {"apikey": SR, "Authorization": f"Bearer {SR}", "Content-Type": "application/json", "Prefer": "return=representation"}

def post_supabase(table, data):
    req = urllib.request.Request(f"{BASE}/{table}", data=json.dumps(data).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def ask_model(provider, prompt):
    payload = json.dumps({"messages": [{"role": "user", "content": prompt}], "provider": provider, "max_tokens": 200}).encode()
    req = urllib.request.Request(ROUTER, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
        return data.get("result", {}).get("content", ""), data.get("result", {}).get("model", "")

# 1. Create war room session
session_id = str(uuid.uuid4())
post_supabase("war_room_sessions", {
    "session_id": session_id,
    "current_stage": "active_discussion",
    "artifacts": {"topic": "SEOBAIKE Global Launch Plan", "patent": "115100981", "commander": "Hsu Chun-Hsiang"}
})
print(f"=== WAR ROOM SESSION: {session_id[:8]} ===\n")

# 2. Each unit discusses the business plan
agenda = [
    ("llama-main", "你是SEOBAIKE市場分析師。用中文50字內回答：SEOBAIKE作為AI界的App Store，第一步該進攻哪個國際市場？為什麼？"),
    ("mistral", "你是SEOBAIKE技術長。用中文50字內回答：我們有NVIDIA NIM 8個模型在線，下一步該如何強化技術護城河？"),
    ("gemma", "你是SEOBAIKE財務長。用中文50字內回答：以專利115100981為核心的CaaS收費模型，定價策略建議？"),
    ("phi3", "你是SEOBAIKE法務長。用中文50字內回答：專利115100981在國際佈局的優先順序？先申請哪些國家？"),
    ("qwen", "你是SEOBAIKE營運長。用中文50字內回答：平台上線後第一個月的KPI該設什麼？具體數字。"),
    ("llama-70b", "你是SEOBAIKE策略長。用中文50字內總結以上所有人的建議，給指揮官許竣翔一個行動方案。"),
]

all_discussion = []

for provider, prompt in agenda:
    try:
        content, model = ask_model(provider, prompt)
        now = datetime.now(timezone.utc).isoformat()
        print(f"[{provider}] {content[:120]}")
        all_discussion.append({"unit": provider, "model": model, "content": content})

        # Write to neural_sync_stream (real-time feed)
        post_supabase("neural_sync_stream", {
            "brainwave_pattern": json.dumps({"unit": provider, "model": model, "role": prompt.split("。")[0].replace("你是",""), "session": session_id[:8]}),
            "thought_vector": json.dumps({"message": content, "topic": "global_launch_plan"}),
            "system_feedback_signal": json.dumps({"status": "delivered", "patent": "115100981"})
        })

        # Write to ai_logs as discussion record
        post_supabase("ai_logs", {
            "action": "war_room_discussion",
            "agent": provider,
            "log_type": "strategy",
            "success": True,
            "details": json.dumps({"model": model, "message": content, "session": session_id[:8], "topic": "global_launch_plan"})
        })
        print(f"  -> Supabase OK")
    except Exception as e:
        print(f"[{provider}] ERROR: {e}")

# 3. Write strategic objective summary
try:
    summary = " | ".join([f"{d['unit']}: {d['content'][:60]}" for d in all_discussion])
    post_supabase("strategic_objectives", {
        "objective_text": f"SEOBAIKE Global Launch Plan - War Room {session_id[:8]}",
        "priority": "high",
        "status": "planning",
        "metadata": json.dumps({
            "session_id": session_id,
            "discussion_count": len(all_discussion),
            "models_participated": [d["model"] for d in all_discussion],
            "patent": "115100981",
            "summary": summary[:1000]
        })
    })
    print(f"\nstrategic_objectives -> written")
except Exception as e:
    print(f"\nstrategic_objectives error: {e}")

# 4. Write command decision
try:
    post_supabase("command_decisions", {
        "decision_type": "strategic_planning",
        "context": json.dumps({"session": session_id, "participants": len(all_discussion), "topic": "global_launch"}),
        "recommendation": summary[:500] if all_discussion else "No data",
        "status": "pending_approval",
        "decided_by": "ai_war_room",
        "impact_assessment": json.dumps({"patent": "115100981", "scope": "international", "urgency": "high"})
    })
    print("command_decisions -> written")
except Exception as e:
    err = e.read().decode()[:200] if hasattr(e, 'read') else str(e)
    print(f"command_decisions error: {err}")

print(f"\n=== WAR ROOM COMPLETE: {len(all_discussion)}/{len(agenda)} units reported ===")
print("Boss: check Supabase tables -> neural_sync_stream, ai_logs, strategic_objectives")
