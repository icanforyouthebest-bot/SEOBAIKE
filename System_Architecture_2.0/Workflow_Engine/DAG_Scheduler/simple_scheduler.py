import subprocess
import json
import sys
import os

WORKFLOW_STEPS = [
    {
        "step_id": 1,
        "agent": "data",
        "description": "模擬從資料庫讀取營收數據",
        "task": "extract_daily_sales",
        "params": {}
    },
    {
        "step_id": 2,
        "agent": "finance",
        "description": "執行核心利潤運算邏輯",
        "task": "calculate_net_profit",
        "data": {"revenue": 50000, "cost": 12000}
    }
]

def run_scheduler():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    master_agent_path = os.path.join(base_dir, "Agent_Orchestration", "Master_Agent", "main.py")

    print("--- [DAG ENGINE] 啟動自動化工作流：每日財務結算 ---")

    pipeline_results = []

    for step in WORKFLOW_STEPS:
        print(f"\n>>> 步驟 {step['step_id']}: {step['description']} (Agent: {step['agent']})")

        command_payload = {
            "agent_role": step["agent"],
            "task": step["task"]
        }
        if "data" in step:
            command_payload["data"] = step["data"]
        if "params" in step:
            command_payload["params"] = step["params"]

        json_payload = json.dumps(command_payload)

        try:
            result = subprocess.run(
                [sys.executable, master_agent_path, "--command", json_payload],
                capture_output=True,
                text=True,
                check=True
            )
            output = json.loads(result.stdout.strip())
            pipeline_results.append({"step": step["step_id"], "status": "success", "output": output})
            print(f"    結果: {json.dumps(output, ensure_ascii=False)}")
        except subprocess.CalledProcessError as e:
            pipeline_results.append({"step": step["step_id"], "status": "failed", "error": e.stderr})
            print(f"    !!! 失敗: {e.stderr}")
            break
        except Exception as e:
            pipeline_results.append({"step": step["step_id"], "status": "error", "error": str(e)})
            print(f"    !!! 錯誤: {str(e)}")
            break

    print("\n--- [DAG ENGINE] 工作流執行完畢 ---")
    summary = {
        "workflow": "daily_finance_settlement",
        "total_steps": len(WORKFLOW_STEPS),
        "completed": len([r for r in pipeline_results if r["status"] == "success"]),
        "failed": len([r for r in pipeline_results if r["status"] != "success"]),
        "results": pipeline_results
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary

if __name__ == "__main__":
    run_scheduler()
