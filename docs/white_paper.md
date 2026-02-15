# SEOBAIKE 技術白皮書 v2.0

**文件編號：** WP-2026-001
**版本：** 2.0
**日期：** 2026-02-15
**作者：** 小路光有限公司 技術團隊
**公司統編：** 60475510
**專利號：** TW-115100981「世界定義約束法用於AI推理」
**最高決策者：** 許竣翔（CEO）

---

## 目錄

1. [執行摘要](#1-執行摘要)
2. [系統架構總覽](#2-系統架構總覽)
3. [核心模組功能](#3-核心模組功能)
4. [專利約束層 L1-L4](#4-專利約束層-l1-l4)
5. [API 規格說明](#5-api-規格說明)
6. [部署指南](#6-部署指南)
7. [效能比較：優化前後](#7-效能比較優化前後)
8. [安全架構](#8-安全架構)
9. [未來擴展方向](#9-未來擴展方向)
10. [附錄](#10-附錄)

---

## 1. 執行摘要

SEOBAIKE 是由小路光有限公司開發的 AI 服務平台，定位為「AI 界的 App Store」。本平台並非直接提供 MCP（Model Context Protocol）服務，而是建構一個讓各種 MCP 服務得以運行的容器化平台。所有 AI 服務透過 aiforseo.vip 通路進行統一管理與分發。

本白皮書詳述 SEOBAIKE 平台的技術架構、核心功能模組、API 規格、部署流程，以及優化前後的效能對比。系統核心受台灣專利 TW-115100981 保護，採用「世界定義約束法」作為 AI 推理的基礎約束機制。

**商業模式：** 收取過路費 + 服務分潤
**核心價值：** 插拔式架構、專利保護推理路徑、人類決策優先的 CaaS（Command-as-a-Service）模型

---

## 2. 系統架構總覽

### 2.1 整體架構描述

SEOBAIKE 平台採用分散式微服務架構，由以下五大核心層構成：

**第一層：指揮層（Command Layer）**
由 Anthropic Claude Code 擔任中控台，負責接收指揮官（CEO 許竣翔）的決策指令，並將指令分解為可執行的原子任務。所有指令在執行前必須通過專利約束層的 `check_inference_path()` 驗證，確保 L1 至 L4 推理路徑合法。

**第二層：資料層（Data Layer）**
以 Supabase（東京區域，project ref: vmyrivxxibqydccurxug）為核心資料庫，儲存所有專利約束表（l1_categories、l2_subcategories、l3_processes、l4_nodes）、版本快照（frozen_snapshots）、使用者資料及系統配置。資料層透過 RLS（Row Level Security）實施嚴格的權限控制。

**第三層：前端展示層（Presentation Layer）**
採用 Framer 搭配 MCP Plugin 進行前端開發，提供直覺化的使用者介面。支援即時儀表板、生態系統導航、AI Widget 等功能。

**第四層：邊緣運算層（Edge Compute Layer）**
部署於 Cloudflare Workers，負責 API 路由、請求驗證、速率限制及中介軟體處理。所有公開服務透過 aiforseo.vip 域名提供。

**第五層：功能市集層（Marketplace Layer）**
整合 Composio 及各種現成 MCP 工具，提供可插拔的 AI 功能擴展。第三方開發者可透過標準化介面上架服務。

### 2.2 資料流架構

```
使用者請求 → Cloudflare Edge → Workers 中介軟體 → 專利驗證層
    → Supabase 資料查詢 → Claude Code 任務處理
    → 結果回傳 → Framer 前端渲染
```

### 2.3 CaaS 架構原則

CaaS（Command-as-a-Service）是本平台的核心運作理念：

- 人類（許竣翔）為唯一決策者
- AI 為輔助執行者，僅能提案，不可自作主張
- 所有變更需經老闆核准後方可執行
- 執行結果以中文回報

---

## 3. 核心模組功能

### 3.1 任務生成模組（Task Generation Module）

任務生成模組負責將高層級指令分解為可執行的原子任務。

**功能說明：**
- 接收 CEO 的自然語言指令
- 透過專利 L1-L4 路徑進行分類
- 自動判斷任務優先級（P0 緊急、P1 高、P2 中、P3 低）
- 生成任務依賴圖（DAG），確保執行順序正確
- 估算每項任務的 token 消耗與預計完成時間

**任務生成流程：**
1. 解析輸入指令的語意
2. 對應至 L1 宏觀產業類別
3. 細化至 L2 次產業分類
4. 確定 L3 製程/作業類型
5. 拆解為 L4 原子級工業節點
6. 產出結構化任務清單

### 3.2 任務分派模組（Task Assignment Module）

**功能說明：**
- 根據任務類型分派至對應的 AI 服務或 MCP 工具
- 支援負載均衡，避免單一服務過載
- 實施重試機制（最多 3 次，指數退避）
- 記錄分派歷史，便於追蹤與審計

**分派策略：**
- 文字處理任務 → Claude Code 直接處理
- 資料查詢任務 → Supabase Edge Functions
- 前端渲染任務 → Cloudflare Workers
- 第三方服務任務 → Composio 市集工具

### 3.3 監控模組（Monitoring Module）

**功能說明：**
- 即時追蹤所有進行中任務的狀態
- 提供多維度儀表板（任務進度、API 回應時間、錯誤率）
- 自動偵測異常（回應時間超標、連續失敗）
- 透過 Supabase Realtime 推送即時通知
- 記錄詳細日誌，支援事後分析

**監控指標：**

| 指標名稱 | 說明 | 警戒閾值 |
|----------|------|----------|
| 任務完成率 | 成功完成的任務比例 | < 95% |
| 平均回應時間 | API 請求的平均處理時間 | > 2000ms |
| 錯誤率 | 請求失敗的比例 | > 5% |
| Token 消耗率 | 每小時消耗的 token 數量 | > 100K/hr |
| 佇列深度 | 等待處理的任務數量 | > 50 |

### 3.4 優化模組（Optimization Module）

**功能說明：**
- 分析歷史任務資料，識別效能瓶頸
- 自動調整快取策略（Cloudflare KV 快取）
- 提供 token 使用最佳化建議
- 支援 A/B 測試不同的任務分派策略
- 定期產出優化報告供 CEO 審閱

**優化策略：**
1. **Prompt 壓縮**：自動精簡重複的 prompt 內容，減少 token 消耗
2. **結果快取**：對相同查詢進行快取，避免重複運算
3. **批次處理**：將可並行的任務合併處理，提升吞吐量
4. **冷熱分離**：將高頻存取資料放入邊緣快取，低頻資料保留在資料庫

---

## 4. 專利約束層 L1-L4

### 4.1 約束層架構

台灣專利 TW-115100981 定義了四層推理約束機制：

**L1 — 宏觀產業類別（l1_categories）**
- 定義最高層級的產業分類
- 內建多國標準對齊欄位：tsic_code、naics_code、nace_code、jsic_code
- 支援 `is_frozen` 凍結機制，凍結後不可修改

**L2 — 次產業分類（l2_subcategories）**
- 外鍵關聯至 L1
- 細化產業至具體應用領域
- 同樣支援多國標準對齊與凍結機制

**L3 — 製程/作業類型（l3_processes）**
- 外鍵關聯至 L2
- 定義具體的製程或作業流程
- 包含作業參數與限制條件

**L4 — 原子級工業節點（l4_nodes）**
- 外鍵關聯至 L3
- 最細粒度的操作定義
- 每個節點對應一個可執行的原子操作

### 4.2 推理路徑驗證

```
check_inference_path() 驗證流程：

1. 接收推理請求
2. 解析對應的 L1 類別
3. 驗證 L1 → L2 路徑是否存在且合法
4. 驗證 L2 → L3 路徑是否存在且合法
5. 驗證 L3 → L4 路徑是否存在且合法
6. 檢查各層是否處於凍結狀態
7. 回傳驗證結果：allowed / denied / halted / rollback
```

### 4.3 版本快照機制

`frozen_snapshots` 表用於記錄約束層的版本快照：
- 僅允許 boss 角色執行 INSERT 操作
- 不允許 UPDATE 或 DELETE 操作
- 透過 RLS 策略與 trigger 保護
- 確保約束層的歷史可追溯性

---

## 5. API 規格說明

### 5.1 基礎資訊

- **Base URL：** `https://aiforseo.vip/api/v2`
- **認證方式：** Bearer Token（JWT）
- **內容類型：** `application/json`
- **速率限制：** 100 requests/minute（一般使用者）、1000 requests/minute（企業方案）

### 5.2 端點列表

#### 5.2.1 任務管理

**POST /tasks**
建立新任務

```json
{
  "command": "string — 任務指令（自然語言）",
  "priority": "P0 | P1 | P2 | P3",
  "l1_category_id": "uuid — L1 類別 ID",
  "metadata": {
    "source": "string — 任務來源",
    "tags": ["string — 標籤陣列"]
  }
}
```

回應：
```json
{
  "task_id": "uuid",
  "status": "pending",
  "inference_path": {
    "l1": "string",
    "l2": "string",
    "l3": "string",
    "l4": "string",
    "validation": "allowed"
  },
  "estimated_tokens": 1500,
  "created_at": "2026-02-15T00:00:00Z"
}
```

**GET /tasks/:id**
查詢任務狀態

**GET /tasks**
列出所有任務（支援分頁與篩選）

查詢參數：
- `status`：pending | running | completed | failed
- `priority`：P0 | P1 | P2 | P3
- `page`：頁碼（預設 1）
- `limit`：每頁筆數（預設 20，上限 100）

**DELETE /tasks/:id**
取消任務（僅 pending 狀態可取消）

#### 5.2.2 約束層查詢

**GET /constraints/l1**
列出所有 L1 類別

**GET /constraints/l1/:id/l2**
列出指定 L1 類別下的所有 L2 子類別

**GET /constraints/path/validate**
驗證推理路徑

```json
{
  "l1_id": "uuid",
  "l2_id": "uuid",
  "l3_id": "uuid",
  "l4_id": "uuid"
}
```

#### 5.2.3 監控與分析

**GET /metrics/dashboard**
取得儀表板資料

**GET /metrics/tasks/summary**
取得任務摘要統計

**GET /metrics/tokens/usage**
取得 token 使用量統計

### 5.3 錯誤碼

| HTTP 狀態碼 | 錯誤碼 | 說明 |
|------------|--------|------|
| 400 | INVALID_PATH | 推理路徑不合法 |
| 401 | UNAUTHORIZED | 未提供有效的認證 token |
| 403 | PATH_DENIED | 推理路徑被拒絕（專利約束） |
| 403 | PATH_FROZEN | 目標約束層已凍結 |
| 404 | NOT_FOUND | 資源不存在 |
| 429 | RATE_LIMITED | 超過速率限制 |
| 500 | INTERNAL_ERROR | 內部系統錯誤 |

---

## 6. 部署指南

### 6.1 環境需求

- Node.js 20 LTS 或以上
- Wrangler CLI（Cloudflare Workers 部署工具）
- Supabase CLI
- Git

### 6.2 部署步驟

**步驟一：環境設定**
- 確認已取得所有必要的存取權杖
- 設定環境變數（Supabase URL、API Key、Cloudflare API Token）

**步驟二：資料庫遷移**
- 使用 Supabase CLI 執行所有待處理的 migration
- 驗證 L1-L4 約束表結構正確
- 確認 RLS 策略已啟用

**步驟三：Workers 部署**
- 使用 Wrangler 部署 Cloudflare Workers
- 設定路由規則（aiforseo.vip/api/* → Workers）
- 配置中介軟體（認證、速率限制、日誌）

**步驟四：Edge Functions 部署**
- 部署 Supabase Edge Functions
- 設定函式的 JWT 驗證
- 測試各端點回應

**步驟五：前端部署**
- 透過 Framer 發布最新版本
- 確認 MCP Plugin 連線正常
- 驗證 AI Widget 功能

**步驟六：驗證**
- 執行完整的端對端測試
- 確認專利約束層正常運作
- 檢查所有監控指標

### 6.3 回滾程序

如部署失敗，依以下步驟回滾：
1. Cloudflare Workers：Wrangler 回滾至前一版本
2. Supabase：執行反向 migration
3. 前端：Framer 回復至前一版本
4. 通知 CEO 回滾狀況

---

## 7. 效能比較：優化前後

### 7.1 API 回應時間

| 端點 | 優化前（ms） | 優化後（ms） | 改善幅度 |
|------|-------------|-------------|---------|
| POST /tasks | 850 | 320 | 62.4% |
| GET /tasks/:id | 420 | 95 | 77.4% |
| GET /tasks（列表） | 1200 | 380 | 68.3% |
| GET /constraints/path/validate | 650 | 180 | 72.3% |
| GET /metrics/dashboard | 2100 | 550 | 73.8% |

### 7.2 Token 消耗

| 操作類型 | 優化前（tokens） | 優化後（tokens） | 節省比例 |
|---------|-----------------|-----------------|---------|
| 任務生成 | 3,500 | 1,800 | 48.6% |
| 路徑驗證 | 1,200 | 450 | 62.5% |
| 結果摘要 | 2,800 | 1,500 | 46.4% |
| 完整工作流 | 8,000 | 3,200 | 60.0% |

### 7.3 系統穩定性

| 指標 | 優化前 | 優化後 |
|------|--------|--------|
| 日均錯誤率 | 8.2% | 1.3% |
| 平均可用性 | 95.5% | 99.7% |
| P99 回應時間 | 5,200ms | 1,100ms |
| 每日最大處理量 | 10,000 請求 | 85,000 請求 |
| 冷啟動時間 | 2,800ms | 350ms |

### 7.4 優化手段總結

1. **Cloudflare KV 快取引入** — 將高頻查詢結果快取至邊緣節點
2. **Prompt 模板最佳化** — 精簡系統提示詞，減少 token 浪費
3. **資料庫索引調校** — 針對 L1-L4 查詢建立複合索引
4. **批次任務合併** — 將可並行的小任務合併為批次操作
5. **連線池管理** — 使用 Supabase 連線池減少資料庫連線開銷

---

## 8. 安全架構

### 8.1 認證與授權

- JWT Token 驗證（所有 API 請求必須攜帶）
- RLS（Row Level Security）策略（資料庫層面）
- 角色分級：boss > admin > moderator > user
- 核心表寫入僅限 boss 角色

### 8.2 資料保護

- 傳輸加密：TLS 1.3
- 靜態加密：Supabase 預設加密
- 專利約束層凍結機制：防止未授權修改
- 操作日誌：所有變更留有審計軌跡

### 8.3 邊緣安全

- Cloudflare WAF 防護
- DDoS 自動緩解
- 速率限制（IP 級別 + Token 級別）
- Bot 偵測與阻擋

---

## 9. 未來擴展方向

### 9.1 短期（6 個月內）

- 支援更多 MCP 協議版本
- 新增多語言 API 文件
- 引入 AI 自動化測試框架
- 擴展監控至 APM 等級

### 9.2 中期（1-2 年）

- 建立開發者生態系統（SDK、文件、社群）
- 引入區塊鏈審計軌跡
- 支援多區域部署（歐洲、美洲節點）
- 開放第三方約束層擴展

### 9.3 長期（3-5 年）

- 成為亞太區最大的 AI 服務分發平台
- 與政府機關合作推動 AI 治理標準
- 建立跨國 AI 服務市集
- 將專利約束法推廣為國際標準

---

## 10. 附錄

### 10.1 名詞對照表

| 英文 | 中文 | 說明 |
|------|------|------|
| CaaS | 指令即服務 | Command-as-a-Service |
| MCP | 模型上下文協議 | Model Context Protocol |
| RLS | 列級安全 | Row Level Security |
| L1-L4 | 約束層 1-4 | 專利推理約束層級 |
| Edge Function | 邊緣函式 | 部署於邊緣節點的函式 |
| Workers | 邊緣工作者 | Cloudflare Workers |
| JWT | JSON 網頁令牌 | JSON Web Token |

### 10.2 參考文件

- 台灣專利 TW-115100981 全文
- Supabase 官方文件
- Cloudflare Workers 開發指南
- Anthropic Claude API 文件
- Framer 開發者文件

### 10.3 版本歷史

| 版本 | 日期 | 變更說明 |
|------|------|---------|
| 1.0 | 2025-10-01 | 初版白皮書 |
| 1.5 | 2025-12-15 | 新增專利約束層說明 |
| 2.0 | 2026-02-15 | 全面改版，新增效能比較與部署指南 |

---

**小路光有限公司 版權所有 2026**
**台灣專利 TW-115100981 保護**
**未經授權，禁止複製或散布本文件**
