# SEOBAIKE 平台收錄證明與誠實說明

**日期**：2026-02-15
**專利**：TW-115100981 | **公司**：小路光有限公司 | **CEO**：許竣翔
**撰寫者**：Opus 4.6 (Claude Code)

---

## 一、總覽

| 項目 | 數值 |
|------|------|
| ai_model_registry 總記錄數 | 4,000 筆 |
| 不重複供應商數 | 2,760 個 |
| 收錄期間 | 2026-02-13 ~ 2026-02-15 |
| 執行波次 | 154 波 |

---

## 二、誠實揭露：「收錄」非「註冊」

### 2.1 實際做了什麼

所有 4,000 筆平台記錄是透過以下流程產生的：

1. **WebSearch 搜索** — 使用搜索引擎查找各產業垂直領域的 AI/SaaS 平台
2. **公開資料整理** — 根據搜索結果中的公開資訊（公司名、產品名、功能描述）
3. **SQL INSERT 匯入** — 透過 Supabase `apply_migration` 工具將記錄寫入 `ai_model_registry` 表

### 2.2 沒有做什麼

- **未向 4,000 個平台逐一註冊帳號**
- **未取得各平台 API 金鑰**
- **未進行 API 連接測試**
- **未簽署任何平台合作協議**
- **未取得各平台使用授權**

### 2.3 正名

| 錯誤用詞 | 正確用詞 | 說明 |
|---------|---------|------|
| 「註冊」 | 「收錄」 | 將公開資訊記錄到資料庫 |
| 「平台連接」 | 「平台目錄」 | 目錄清單，非即時連接 |
| 「API 整合」 | 「API 目標清單」 | 預計整合，尚未實際串接 |

---

## 三、每日收錄統計

| 日期 | 收錄數 | 供應商數 | 說明 |
|------|--------|---------|------|
| 2026-02-13 | 3 | 3 | 初始設定（openai 等） |
| 2026-02-14 | 46 | 10 | 早期手動 + MCP/NVIDIA 匯入 |
| 2026-02-15 | 3,951 | 2,750 | 永動機式掃描 Wave 1-154 |

---

## 四、收錄分層統計

| Tier | 數量 | 佔比 | 說明 |
|------|------|------|------|
| enterprise | 2,319 | 58.0% | 企業級 SaaS/AI 服務 |
| platform | 817 | 20.4% | 平台型服務 |
| standard | 758 | 19.0% | 標準服務 |
| flagship | 78 | 2.0% | 旗艦產品 |
| edge | 9 | 0.2% | 邊緣運算 |
| infra | 8 | 0.2% | 基礎設施 |
| fast | 7 | 0.2% | 快速推理 |
| safety | 4 | 0.1% | 安全模型 |

---

## 五、前 50 大供應商

| 排名 | 供應商 | 收錄數 |
|------|--------|--------|
| 1 | Google | 34 |
| 2 | Microsoft | 24 |
| 3 | Amazon | 19 |
| 4 | analytics | 18 |
| 5 | nvidia | 18 |
| 6 | hrtech | 17 |
| 7 | logistics | 17 |
| 8 | blockchain | 16 |
| 9 | edtech | 16 |
| 10 | cybersecurity | 15 |
| 11 | legaltech | 15 |
| 12 | iot | 14 |
| 13 | fintech | 13 |
| 14 | NVIDIA | 13 |
| 15 | healthtech | 12 |
| 16 | proptech | 12 |
| 17 | govtech | 12 |
| 18 | insurtech | 12 |
| 19 | energy | 12 |
| 20 | cloud | 11 |
| 21 | gamedev | 11 |
| 22 | communication | 11 |
| 23 | enterprise | 11 |
| 24 | api_mgmt | 11 |
| 25 | asia_pacific | 10 |
| 26 | Meta | 10 |
| 27 | mcp | 10 |
| 28 | framework | 10 |
| 29 | openai | 9 |
| 30 | quantum | 9 |
| 31 | database | 8 |
| 32 | Siemens | 8 |
| 33 | autonomous | 8 |
| 34 | defense | 8 |
| 35 | ecommerce | 8 |
| 36 | payment | 7 |
| 37 | devops | 7 |
| 38 | ai_coding | 7 |
| 39 | biotech | 7 |
| 40 | Oracle | 7 |
| 41 | agritech | 7 |
| 42 | Cloudflare | 6 |
| 43 | manufacturing | 6 |
| 44 | Twilio | 6 |
| 45 | smartcity | 6 |
| 46 | rpa | 6 |
| 47 | wearable | 6 |
| 48 | education | 6 |
| 49 | telecom_5g | 6 |
| 50 | Autodesk | 6 |

---

## 六、收錄證明方式

由於 4,000 筆記錄是透過 SQL INSERT 產生，可提供的證明如下：

### 可提供的證明

| # | 證明類型 | 說明 | 狀態 |
|---|---------|------|------|
| 1 | Supabase Migration 記錄 | 154 波 migration 均有時間戳與 SQL 內容 | 可查詢 |
| 2 | 資料庫查詢結果 | 即時查詢 ai_model_registry 表 | 可驗證 |
| 3 | WebSearch 搜索歷史 | Claude Code 對話記錄中包含搜索查詢 | 在對話紀錄中 |
| 4 | DDL 稽核日誌 | ddl_audit_log 表記錄所有 DDL 操作 | 可查詢 |
| 5 | Git Commit 歷史 | 本地 git log 記錄 | 可查看 |

### 無法提供的證明

| # | 證明類型 | 原因 |
|---|---------|------|
| 1 | 各平台帳號截圖 | 未實際註冊帳號 |
| 2 | API 連接測試結果 | 未取得各平台 API 金鑰 |
| 3 | 合作協議文件 | 未簽署任何協議 |
| 4 | 平台回應確認信 | 未向平台發送任何請求 |

---

## 七、驗證方法

如需驗證收錄資料的真實性，可執行以下 SQL：

```sql
-- 總數確認
SELECT COUNT(*), COUNT(DISTINCT provider) FROM ai_model_registry;

-- 依 tier 分組
SELECT tier, COUNT(*) FROM ai_model_registry GROUP BY tier ORDER BY count DESC;

-- 依日期分組
SELECT DATE(created_at), COUNT(*) FROM ai_model_registry GROUP BY DATE(created_at);

-- 隨機抽樣 10 筆
SELECT model_id, display_name, provider, tier, created_at
FROM ai_model_registry ORDER BY RANDOM() LIMIT 10;
```

---

## 八、簽署

> **Opus 4.6 聲明**：
>
> 以上說明真實完整。4,000 筆平台記錄均為「資料庫收錄」而非「實際帳號註冊」。
> 此前使用「註冊」一詞有誤導之嫌，特此更正為「收錄」。
> 所有收錄資料均基於公開搜索結果，可獨立驗證。
>
> 簽署人：Opus 4.6 (Claude Code)
> 簽署時間：2026-02-15
> 專利：TW-115100981
> 公司：小路光有限公司

---

*SEOBAIKE — AI 界的 App Store | 專利 TW-115100981 | 小路光有限公司*
