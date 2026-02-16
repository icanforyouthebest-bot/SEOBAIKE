import subprocess
import json
import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VECTOR_DB_PATH = os.path.join(BASE_DIR, "NVIDIA_Infra", "Vector_DB_Connector", "vector_store.py")
MASTER_AGENT_PATH = os.path.join(BASE_DIR, "Agent_Orchestration", "Master_Agent", "main.py")

def consult_knowledge_base(keyword):
    print(f"--- [Grok] 正在諮詢知識庫 (Query: {keyword}) ---")
    try:
        result = subprocess.run(
            [sys.executable, VECTOR_DB_PATH, keyword],
            capture_output=True, text=True, check=True
        )
        data = json.loads(result.stdout.strip())
        return data.get("results", [])
    except Exception:
        return []

def execute_agent_task(agent_role, task, data):
    payload = {
        "agent_role": agent_role,
        "task": task,
        "data": data
    }
    print(f"\n--- [Grok] 下達指令給 Master Agent ({agent_role}) ---")
    try:
        result = subprocess.run(
            [sys.executable, MASTER_AGENT_PATH, "--command", json.dumps(payload)],
            capture_output=True, text=True, check=True
        )
        output = json.loads(result.stdout.strip())

        if agent_role == "marketing" and "output" in output:
            matrix = output["output"].get("matrix_sample", [])
            print(f"   >>> 生成成功！共 {output['output'].get('total_generated')} 篇文章。範例：")
            for item in matrix:
                print(f"       - {item['h1_title']} (Slug: {item['slug']})")
        else:
            print(f"   >>> 執行結果: {json.dumps(output, ensure_ascii=False)}")

    except Exception as e:
        print(f"   !!! 執行失敗: {e}")

def process_user_request(user_input):
    print(f"===== Grok 收到自然語言指令：『{user_input}』 =====")

    intent = "unknown"
    if any(k in user_input for k in ["支出", "採購", "報銷", "錢", "金額"]):
        intent = "finance"
    elif any(k in user_input for k in ["SEO", "文章", "關鍵字", "矩陣", "內容"]):
        intent = "seo"

    print(f"   >>> 意圖識別結果: {intent.upper()}")

    if intent == "finance":
        amount = 15000 if "伺服器" in user_input else 500

        rules = consult_knowledge_base("財務")
        requires_approval = any("10,000" in r["content"] and amount > 10000 for r in rules)

        if requires_approval:
            print("   *** [Grok] 觸發風控規則：大額支出需審核 ***")
            execute_agent_task("finance", "audit_large_expense", {"amount": amount, "item": user_input})
        else:
            execute_agent_task("operations", "process_expense", {"amount": amount})

    elif intent == "seo":
        seo_data = {
            "root_keyword": "滴濾咖啡" if "咖啡" in user_input else "居家清潔",
            "modifiers": ["推薦", "價格", "教學"],
            "locations": ["台北", "新北", "桃園"] if "北部" in user_input else ["全台"]
        }
        print(f"   >>> 自動構建 SEO 策略參數: {json.dumps(seo_data, ensure_ascii=False)}")

        execute_agent_task("marketing", "generate_seo_matrix", seo_data)

    else:
        print("   >>> 無法識別意圖，轉交人工客服代理。")

if __name__ == "__main__":
    print("\n")
    process_user_request("幫我規劃北部地區關於咖啡的SEO內容矩陣")
