import subprocess
import json
import os
import sys

def send_instruction_to_master(agent_role, task_name):
    payload = {
        "agent_role": agent_role,
        "task": task_name,
        "source": "Grok_Beta",
        "timestamp": "2026-02-16T14:00:00Z"
    }
    json_payload = json.dumps(payload)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    master_agent_script = os.path.join(base_dir, "Agent_Orchestration", "Master_Agent", "main.py")

    print(f"--- [GROK LAYER] Initiating Command Sequence ---")
    print(f"Target: {master_agent_script}")
    print(f"Instruction: {json_payload}")

    try:
        result = subprocess.run(
            [sys.executable, master_agent_script, "--command", json_payload],
            capture_output=True,
            text=True,
            check=True
        )
        print(f"--- [EXECUTION LAYER] Response Received ---")
        print(result.stdout.strip())
        return True
    except subprocess.CalledProcessError as e:
        print(f"!!! [ERROR] Execution Failed !!!")
        print(e.stderr)
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("[GROK BRIDGE SIMULATOR] Running Full Agent Test Suite")
    print("=" * 60)

    test_cases = [
        ("finance", "generate_q1_report"),
        ("operations", "optimize_workflow"),
        ("customer", "analyze_churn_rate"),
        ("data", "run_etl_pipeline"),
        ("security", "scan_vulnerabilities"),
        ("marketing", "launch_campaign"),
        ("compliance", "gdpr_audit"),
    ]

    results = {"passed": 0, "failed": 0}

    for agent, task in test_cases:
        print(f"\n[TEST] Agent: {agent} | Task: {task}")
        success = send_instruction_to_master(agent, task)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1

    print("\n" + "=" * 60)
    print(f"[SUMMARY] Passed: {results['passed']} | Failed: {results['failed']}")
    print("=" * 60)
