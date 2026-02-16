import json
import os
import sys
import datetime

PRODUCTION_DIR = "System_Architecture_2.0/Production_Environment/Published_Content"
FEEDBACK_DIR = "System_Architecture_2.0/Core_Logic_System/Domain_Knowledge_DB/Feedback_Logs"

def save_to_production(data, task_type):
    os.makedirs(PRODUCTION_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{task_type}_{timestamp}.json"
    filepath = os.path.join(PRODUCTION_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n[SYSTEM] 已部署至生產環境：{filepath}")

def log_feedback(data, reason):
    os.makedirs(FEEDBACK_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_entry = {
        "timestamp": timestamp,
        "original_data": data,
        "status": "REJECTED",
        "feedback": reason
    }
    filepath = os.path.join(FEEDBACK_DIR, f"feedback_{timestamp}.json")

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(log_entry, f, ensure_ascii=False, indent=2)
    print(f"\n[SYSTEM] 反饋已記錄，將用於優化下一代模型：{filepath}")

def run_review_interface():
    pending_task = {
        "task_id": "TASK-2026-SEO-001",
        "agent": "Marketing Agent",
        "content": [
            {"title": "台北手沖咖啡 - 推薦懶人包 (2026最新版)", "slug": "taipei-drip-coffee-recommend"},
            {"title": "台北手沖咖啡 - 價格懶人包 (2026最新版)", "slug": "taipei-drip-coffee-price"},
            {"title": "台北手沖咖啡 - 教學懶人包 (2026最新版)", "slug": "taipei-drip-coffee-tutorial"}
        ]
    }

    print("+" + "-" * 58 + "+")
    print("|             HUMAN-IN-THE-LOOP REVIEW CONSOLE           |")
    print("+" + "-" * 58 + "+")
    print(f"來源代理: {pending_task['agent']}")
    print(f"任務編號: {pending_task['task_id']}")
    print("-" * 50)
    print("待審核內容 (Content Matrix):")
    for idx, item in enumerate(pending_task["content"]):
        print(f" [{idx+1}] {item['title']}")
        print(f"      Slug: {item['slug']}")
    print("-" * 50)

    while True:
        choice = input("\n請輸入指令 [A]核准發布 / [R]駁回重做 / [Q]離開: ").strip().upper()

        if choice == "A":
            save_to_production(pending_task, "seo_matrix")
            break
        elif choice == "R":
            reason = input("請輸入駁回原因 (供 Grok 學習): ")
            log_feedback(pending_task, reason)
            break
        elif choice == "Q":
            print("操作已取消。")
            break
        else:
            print("無效指令，請重新輸入。")

if __name__ == "__main__":
    run_review_interface()
