import argparse
import json
import sys
import subprocess
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

FINANCE_SCRIPT_PATH = os.path.join(BASE_DIR, "Core_Logic_System", "Automation_Scripts", "finance_core.py")
SEO_SCRIPT_PATH = os.path.join(BASE_DIR, "Core_Logic_System", "Automation_Scripts", "seo_core.py")

def finance_agent(payload):
    try:
        input_data = json.dumps(payload.get("data", {}))
        result = subprocess.run(
            [sys.executable, FINANCE_SCRIPT_PATH, input_data],
            capture_output=True, text=True, check=True
        )
        return json.loads(result.stdout.strip())
    except Exception as e:
        return {"agent": "finance", "status": "error", "error": str(e)}

def marketing_agent(payload):
    try:
        input_data = json.dumps(payload.get("data", {}))
        result = subprocess.run(
            [sys.executable, SEO_SCRIPT_PATH, input_data],
            capture_output=True, text=True, check=True
        )
        return json.loads(result.stdout.strip())
    except Exception as e:
        return {"agent": "marketing", "status": "error", "error": str(e)}

def ops_agent(payload):
    return {"agent": "operations", "result": payload.get("task", ""), "processed": True}

def customer_agent(payload):
    return {"agent": "customer", "result": payload.get("task", ""), "processed": True}

def data_agent(payload):
    return {"agent": "data", "result": payload.get("task", ""), "processed": True}

def security_agent(payload):
    return {"agent": "security", "result": payload.get("task", ""), "processed": True}

def compliance_agent(payload):
    return {"agent": "compliance", "result": payload.get("task", ""), "processed": True}

AGENT_REGISTRY = {
    "finance": finance_agent,
    "operations": ops_agent,
    "customer": customer_agent,
    "data": data_agent,
    "security": security_agent,
    "marketing": marketing_agent,
    "compliance": compliance_agent
}

def dispatch_task(command_json):
    try:
        cmd = json.loads(command_json) if isinstance(command_json, str) else command_json
    except json.JSONDecodeError:
        return {"status": "error", "code": "INVALID_JSON"}

    agent_role = cmd.get("agent_role")
    if not agent_role:
        return {"status": "error", "code": "MISSING_AGENT_ROLE"}

    handler = AGENT_REGISTRY.get(agent_role)
    if not handler:
        return {"status": "error", "code": "UNKNOWN_AGENT", "available": list(AGENT_REGISTRY.keys())}

    try:
        result = handler(cmd)
        return {"status": "success", "output": result}
    except Exception as e:
        return {"status": "error", "code": "EXECUTION_FAILED", "detail": str(e)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--command", type=str, required=True)
    args = parser.parse_args()
    result = dispatch_task(args.command)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()
