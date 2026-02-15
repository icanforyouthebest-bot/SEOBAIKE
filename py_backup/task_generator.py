"""
SEOBAIKE 任務生成器 — 第一層：生成 100 個 AI 任務
創辦人指令：五層任務鏈
"""
import json
import uuid
import random  # unsafe-random-ok: test data generation only
from datetime import datetime

# 任務描述模板
TASK_DESCRIPTIONS = [
    "分析 {site} 網站 SEO 健檢",
    "生成 {industry} 產業分析報告",
    "呼叫 NVIDIA NIM API 推論 {topic}",
    "生成 {topic} 行銷文案",
    "執行 L1→L4 約束路徑檢查",
    "分析 {industry} 產業競爭對手",
    "生成 {industry} 關鍵字研究報告",
    "呼叫 OpenAI GPT-4o 摘要 {topic}",
    "執行 {site} 反向連結分析",
    "生成 {industry} 社群媒體策略",
    "呼叫 Google Gemini 翻譯 {topic}",
    "分析 {site} 網站效能與速度",
    "生成 {industry} 內容行事曆",
    "呼叫 Perplexity 搜尋 {topic} 最新資訊",
    "執行 {site} 技術 SEO 稽核",
    "生成 {industry} 電子報模板",
    "呼叫 DeepSeek 程式碼審查",
    "分析 {industry} 市場趨勢預測",
    "生成 {site} 結構化資料標記",
    "呼叫 NVIDIA Guardrails 安全檢查",
    "執行 {industry} 客戶情感分析",
    "生成 {topic} 影片腳本",
    "呼叫 Meta Llama 多語言翻譯",
    "分析 {site} 使用者行為數據",
    "生成 {industry} 白皮書草稿",
    "呼叫 Mistral 程式碼生成",
    "執行 {site} 行動端適配檢查",
    "生成 {industry} 品牌定位分析",
    "呼叫 HuggingFace 模型推論",
    "分析 {industry} 供應鏈風險評估",
]

INDUSTRIES = [
    "半導體", "金融科技", "醫療健康", "電子商務", "教育科技",
    "物流運輸", "不動產", "能源環保", "製造業", "農業科技",
    "法律科技", "保險科技", "旅遊觀光", "餐飲服務", "零售業",
    "遊戲娛樂", "媒體傳播", "建築營建", "網路安全", "區塊鏈",
]

SITES = [
    "aiforseo.vip", "example-client-a.com", "example-client-b.com",
    "startup-demo.tw", "enterprise-corp.com", "ecommerce-shop.tw",
    "medical-center.com", "fintech-app.tw", "edu-platform.com",
    "logistics-hub.tw",
]

TOPICS = [
    "AI推理效能", "SEO排名策略", "產業約束分析", "客戶行為預測",
    "內容生成優化", "多語言本地化", "品牌聲譽管理", "供應鏈數位化",
    "碳排放追蹤", "智慧城市規劃", "精準醫療", "自駕車技術",
    "量子計算應用", "元宇宙策略", "Web3整合方案",
]

EXTERNAL_APIS = [
    None, None, None,  # 30% 不需外部 API
    "nvidia-nim", "openai-gpt4o", "google-gemini", "perplexity",
    "deepseek", "mistral", "meta-llama", "huggingface",
    "nvidia-guardrails", "nvidia-riva", "anthropic-claude",
    "groq", "cohere", "together-ai", "replicate", "stability-ai",
]

LOCAL_FILES = [
    None, None, None, None,  # 40% 不需本地文件
    "data/seo_report.json", "data/analytics.json", "data/keywords.json",
    "data/competitors.json", "data/backlinks.json", "data/content_plan.json",
    "data/market_analysis.json", "data/user_behavior.json",
    "data/brand_audit.json", "data/supply_chain.json",
]


def generate_tasks(count=100):
    tasks = []
    for i in range(count):
        desc_template = random.choice(TASK_DESCRIPTIONS)
        industry = random.choice(INDUSTRIES)
        site = random.choice(SITES)
        topic = random.choice(TOPICS)

        description = desc_template.format(
            industry=industry, site=site, topic=topic
        )

        task = {
            "task_id": str(uuid.uuid4()),
            "task_number": i + 1,
            "description": description,
            "external_api": random.choice(EXTERNAL_APIS),
            "local_file": random.choice(LOCAL_FILES),
            "needs_git_commit": random.choice([True, False, False]),  # 33% 需要 commit
            "priority": random.choice(["high", "medium", "low"]),
            "estimated_tokens": random.randint(500, 50000),
            "created_at": datetime.now().isoformat(),
            "status": "pending",
        }
        tasks.append(task)

    return tasks


if __name__ == "__main__":
    print("SEOBAIKE 任務生成器啟動...")
    print(f"生成 100 個 AI 任務中...")

    tasks = generate_tasks(100)

    output = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "total_tasks": len(tasks),
            "generator": "SEOBAIKE task_generator.py",
            "patent": "TW-115100981",
            "company": "小路光有限公司",
            "ceo": "許竣翔",
        },
        "tasks": tasks,
    }

    with open("tasks/task_list.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # 統計
    api_tasks = sum(1 for t in tasks if t["external_api"])
    file_tasks = sum(1 for t in tasks if t["local_file"])
    git_tasks = sum(1 for t in tasks if t["needs_git_commit"])
    high_pri = sum(1 for t in tasks if t["priority"] == "high")

    print(f"\n=== 任務生成完成 ===")
    print(f"總任務數: {len(tasks)}")
    print(f"需外部 API: {api_tasks}")
    print(f"需本地文件: {file_tasks}")
    print(f"需 Git Commit: {git_tasks}")
    print(f"高優先: {high_pri}")
    print(f"輸出: tasks/task_list.json")
