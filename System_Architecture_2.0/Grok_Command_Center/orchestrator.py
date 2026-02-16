import subprocess
import json
import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER_AGENT_PATH = os.path.join(BASE_DIR, "Agent_Orchestration", "Master_Agent", "main.py")
REVIEW_SCRIPT_PATH = os.path.join(BASE_DIR, "Execution_Layer", "Human_Feedback", "console_review.py")

def run_agent(agent_role, task, data):
    payload = json.dumps({"agent_role": agent_role, "task": task, "data": data})
    result = subprocess.run(
        [sys.executable, MASTER_AGENT_PATH, "--command", payload],
        capture_output=True, text=True, check=True
    )
    return json.loads(result.stdout.strip())

def main():
    print("+" + "-" * 58 + "+")
    print("|     COMPLEX ORCHESTRATOR: FINANCE -> SEO -> HUMAN      |")
    print("+" + "-" * 58 + "+")

    project_budget = 12000
    project_target = "高雄手沖咖啡"

    print(f"\n[PHASE 1] 啟動財務審核 (預算: {project_budget})")

    finance_res = run_agent("finance", "check_budget", {"revenue": project_budget, "cost": 0})

    if finance_res.get("status") == "success":
        output = finance_res["output"]
        print(f"   >>> 財務系統回應: {output}")
        print("   >>> 財務檢核通過 (模擬)。")
    else:
        print("   !!! 財務檢核失敗，終止流程。")
        return

    print(f"\n[PHASE 2] 啟動 SEO 矩陣生成 (目標: {project_target})")

    seo_data = {
        "root_keyword": "手沖咖啡",
        "modifiers": ["評比", "優惠", "地圖"],
        "locations": ["高雄"]
    }
    seo_res = run_agent("marketing", "generate_matrix", seo_data)

    if seo_res.get("status") == "success":
        matrix = seo_res["output"].get("matrix_sample", [])
        print(f"   >>> SEO 系統生成 {seo_res['output'].get('total_generated')} 筆內容。")

        print(f"\n[PHASE 3] 提交至人工審核台 (Human Loop)")
        print("   >>> 數據已暫存。請執行 `console_review.py` 進行最終放行。")

    else:
        print("   !!! SEO 生成失敗。")

if __name__ == "__main__":
    main()
