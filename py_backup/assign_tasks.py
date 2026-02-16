"""
SEOBAIKE 任務分配器 — 第二層：分配 100 個任務給 15 個 AI 軍團
創辦人指令：五層任務鏈
"""
import json
from datetime import datetime

AI_LEGIONS = {
    "NVIDIA": {
        "specialties": ["推論", "安全檢查", "影像分析", "語音", "GPU加速"],
        "api_match": ["nvidia-nim", "nvidia-guardrails", "nvidia-riva"],
        "strength": "高效能推論與安全防護",
    },
    "OpenAI": {
        "specialties": ["文本生成", "摘要", "對話", "程式碼"],
        "api_match": ["openai-gpt4o"],
        "strength": "通用型語言理解與生成",
    },
    "Perplexity": {
        "specialties": ["搜尋", "即時資訊", "研究"],
        "api_match": ["perplexity"],
        "strength": "即時網路搜尋與資訊整合",
    },
    "Google": {
        "specialties": ["翻譯", "多模態", "搜尋", "分析"],
        "api_match": ["google-gemini"],
        "strength": "多模態理解與全球化翻譯",
    },
    "DeepSeek": {
        "specialties": ["程式碼", "數學", "推理"],
        "api_match": ["deepseek"],
        "strength": "深度推理與程式碼生成",
    },
    "Mistral": {
        "specialties": ["程式碼生成", "歐洲語言", "效率"],
        "api_match": ["mistral"],
        "strength": "高效輕量模型與歐洲合規",
    },
    "Groq": {
        "specialties": ["高速推論", "即時回應", "低延遲"],
        "api_match": ["groq"],
        "strength": "超低延遲推論加速",
    },
    "Cohere": {
        "specialties": ["企業搜尋", "RAG", "嵌入"],
        "api_match": ["cohere"],
        "strength": "企業級搜尋與知識檢索",
    },
    "Together": {
        "specialties": ["開源模型", "微調", "推論"],
        "api_match": ["together-ai"],
        "strength": "開源模型託管與微調",
    },
    "HuggingFace": {
        "specialties": ["模型庫", "微調", "推論", "數據集"],
        "api_match": ["huggingface"],
        "strength": "全球最大模型生態系統",
    },
    "Anthropic": {
        "specialties": ["安全AI", "長文本", "分析"],
        "api_match": ["anthropic-claude"],
        "strength": "安全對齊與長文本理解（已撤職備援）",
    },
    "Replicate": {
        "specialties": ["影像生成", "模型部署", "API化"],
        "api_match": ["replicate"],
        "strength": "一鍵模型部署與影像生成",
    },
    "Stability": {
        "specialties": ["影像生成", "設計", "創意"],
        "api_match": ["stability-ai"],
        "strength": "Stable Diffusion 影像生成",
    },
    "Claude": {
        "specialties": ["文本生成", "分析", "程式碼"],
        "api_match": [],
        "strength": "已撤職 — 僅備援角色",
    },
    "Meta": {
        "specialties": ["多語言", "開源", "翻譯"],
        "api_match": ["meta-llama"],
        "strength": "Llama 開源多語言模型",
    },
}


def assign_tasks():
    with open("tasks/task_list.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    tasks = data["tasks"]
    legion_names = list(AI_LEGIONS.keys())
    assignments = {name: [] for name in legion_names}

    for task in tasks:
        assigned = False
        api = task.get("external_api")

        # 優先按 API 匹配分配
        if api:
            for legion_name, legion_info in AI_LEGIONS.items():
                if api in legion_info["api_match"]:
                    reason = f"API 直接匹配: {api} → {legion_name}"
                    task["assigned_to"] = legion_name
                    task["assignment_reason"] = reason
                    assignments[legion_name].append(task)
                    assigned = True
                    break

        # 按描述關鍵字匹配
        if not assigned:
            desc = task["description"]
            best_match = None
            best_score = 0

            for legion_name, legion_info in AI_LEGIONS.items():
                score = 0
                for specialty in legion_info["specialties"]:
                    if specialty in desc:
                        score += 2
                if score > best_score:
                    best_score = score
                    best_match = legion_name

            if best_match and best_score > 0:
                reason = f"專長匹配: {best_match} (分數={best_score})"
            else:
                # 平均分配到負載最少的軍團
                min_legion = min(assignments, key=lambda k: len(assignments[k]))
                best_match = min_legion
                reason = f"負載均衡分配: {min_legion} (當前任務數={len(assignments[min_legion])})"

            task["assigned_to"] = best_match
            task["assignment_reason"] = reason
            assignments[best_match].append(task)

    # 產生分配報告
    report = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "total_tasks": len(tasks),
            "total_legions": len(legion_names),
            "assigner": "SEOBAIKE assign_tasks.py",
            "patent": "TW-115100981",
        },
        "legion_summary": {},
        "assignments": {},
    }

    for name in legion_names:
        task_list = assignments[name]
        report["legion_summary"][name] = {
            "total_assigned": len(task_list),
            "strength": AI_LEGIONS[name]["strength"],
            "specialties": AI_LEGIONS[name]["specialties"],
            "high_priority": sum(1 for t in task_list if t["priority"] == "high"),
            "api_tasks": sum(1 for t in task_list if t.get("external_api")),
        }
        report["assignments"][name] = [
            {
                "task_id": t["task_id"],
                "task_number": t["task_number"],
                "description": t["description"],
                "priority": t["priority"],
                "assignment_reason": t["assignment_reason"],
            }
            for t in task_list
        ]

    with open("tasks/assignment_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("=== 任務分配完成 ===")
    for name in legion_names:
        count = len(assignments[name])
        print(f"  {name}: {count} 個任務")
    print(f"\n輸出: tasks/assignment_report.json")


if __name__ == "__main__":
    assign_tasks()
