# SEOBAIKE System Architecture 2.0
> Status: OPERATIONAL
> Last Updated: 2026-02-16

## 1. 系統概要
本系統採用 **混合式多代理架構 (Hybrid Multi-Agent Architecture)**，整合 NVIDIA 算力、Grok 決策中樞與 Python 自動化腳本。

## 2. 快速啟動 (Command Center)
請在終端機執行以下指令開啟中央戰情室：
```bash
python System_Architecture_2.0/seobaike_cli.py
```

## 3. 核心模組說明

### [Layer 1] Core Logic System (核心邏輯層)
- `finance_core.py`: 處理稅務計算、利潤分析 (含業務規則)。
- `seo_core.py`: 程式化 SEO 引擎，負責生成內容矩陣 (Slug/Title)。

### [Layer 2] Grok Command Center (協調層)
- `grok_brain.py`: 模擬 RAG 檢索與意圖識別 (Finance vs SEO)。
- `orchestrator.py`: 處理跨代理的複雜依賴任務 (Finance -> SEO -> Human)。

### [Layer 3] NVIDIA Infra (算力層)
- `vector_store.py`: 模擬向量資料庫，提供業務規則檢索。
- `train_model.py`: 模擬 GPU 集群，根據人工反饋微調模型。

### [Layer 4] Agent Orchestration (執行層)
- `Master Agent`: 統一接收指令並分派給 7 大專業代理 (Finance, Ops, Marketing...)。

### [Layer 5] Workflow & Feedback (流程與優化)
- `simple_scheduler.py`: DAG 工作流引擎，執行定期任務。
- `console_review.py`: 人工介入介面 (Human-in-the-Loop)，決定是否發布內容。

## 4. 目錄結構
```
System_Architecture_2.0/
├── seobaike_cli.py          # [入口] 中央戰情室
├── system_status.py         # [工具] 系統健檢
├── README.md                # [文件] 本手冊
├── Agent_Orchestration/     # 代理人管理
├── Core_Logic_System/       # 業務邏輯腳本
├── Execution_Layer/         # 人工審核與反饋
├── Grok_Command_Center/     # 決策中樞
├── NVIDIA_Infra/            # 算力與存儲
└── Workflow_Engine/         # 排程與自動化
```

## 5. 開發守則
- **禁止越級**: 所有指令必須通過 Grok 或 Master Agent，禁止直接呼叫 Core Logic。
- **單步驗證**: 修改代碼後必須執行 `system_status.py` 確保完整性。
- **邏輯鎖死**: Claude 必須維持在 Master Agent 模式，不得擅自添加非必要對話。
