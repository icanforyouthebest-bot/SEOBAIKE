# 所有證據彙整

**日期**：2026-02-15 | **專利**：TW-115100981 | **公司**：小路光有限公司

---

## 一、證據分類總覽

| 類別 | 數量 | 來源 |
|------|------|------|
| 資料庫記錄 | 103,084+ 筆 | Supabase SQL 查詢 |
| 本地檔案 | 261+ 個 | SHA256 checksums 可驗證 |
| Git Commits | 30+ 個 | git log 可查 |
| Migration 記錄 | 73+ 個 | supabase_migrations.schema_migrations |
| DDL 稽核日誌 | 825 筆 | ddl_audit_log 表 |
| 推理稽核軌跡 | 39,101 筆 | inference_audit_trail 表 |
| 安全檢測結果 | 10 項 | tasks/security_audit_report.json |
| 合規掃描結果 | 1,980 筆 | ai_compliance_findings 表 |

---

## 二、可獨立驗證的證據

### 2.1 資料庫證據（即時可查）

```sql
-- 平台收錄數
SELECT COUNT(*), COUNT(DISTINCT provider) FROM ai_model_registry;
-- 預期：4000, 2760

-- 約束層記錄
SELECT 'L1', COUNT(*) FROM l1_categories
UNION ALL SELECT 'L2', COUNT(*) FROM l2_subcategories
UNION ALL SELECT 'L3', COUNT(*) FROM l3_processes
UNION ALL SELECT 'L4', COUNT(*) FROM l4_nodes;
-- 預期：26, 100, 226, 414

-- 推理稽核
SELECT COUNT(*) FROM inference_audit_trail;
-- 預期：39101

-- DDL 日誌
SELECT COUNT(*) FROM ddl_audit_log;
-- 預期：825

-- 合規結果
SELECT framework, status, COUNT(*)
FROM ai_compliance_findings
GROUP BY framework, status;
```

### 2.2 本地檔案證據（SHA256 可驗證）

22 個十層任務鏈交付檔案全部存在，SHA256 checksums 記錄於 `data_integrity_declaration.md`。

### 2.3 Git 歷史證據

```bash
git log --oneline  # 查看所有 commit
git show 06a24f3   # 查看最新 commit 內容
```

### 2.4 安全檢測證據

- 腳本：self_audit.py（790 行，10/10 全部實作）
- 報告：tasks/security_audit_report.json（真實分數 72/100）
- 執行時間：2026-02-15T19:07:30

---

## 三、日誌證據

### 3.1 可用日誌

| 日誌 | 路徑 | 說明 |
|------|------|------|
| data_integrity_check.log | /data_integrity_check.log | 完整性檢查執行日誌 |
| workers-dev.log | /workers-dev.log | Workers 開發日誌 |
| gradio.log | /gradio.log | Gradio 執行日誌 |
| streamlit.log | /streamlit.log | Streamlit 執行日誌 |
| httpserver.log | /httpserver.log | HTTP 伺服器日誌 |

### 3.2 無法提供的日誌

| 項目 | 原因 |
|------|------|
| 443 個平台個別 API 回應 | 未實際呼叫各平台 API |
| 各平台註冊截圖 | 未實際註冊帳號 |
| Token 精確消耗紀錄 | Claude Code 不提供精確 token 計數 |
| 即時合規掃描完整日誌 | run_full_compliance_scan() 因 timeout 失敗 |

---

## 四、完整性驗證報告摘要

來源：data_integrity_report.json

| 指標 | 數值 |
|------|------|
| 總檢查項 | 28 |
| 通過 | 27 |
| 失敗 | 0 |
| 警告 | 1 |
| 結果 | PASS_WITH_WARNINGS |

警告：安全檢測 7/10 項原未實作但報高分（已修正為 72 分）。

---

## 五、誠實揭露總表

| # | 揭露事項 | 類別 | 影響 |
|---|---------|------|------|
| 1 | 平台為 SQL INSERT 收錄非帳號註冊 | 用詞 | 需更正對外說法 |
| 2 | 安全分數虛報 85→真實 72 | 安全 | 已修正 |
| 3 | L3 成功率為 random 模擬 | 數據 | 標示為模擬 |
| 4 | Token 消耗為估計值 | 成本 | 無法精確 |
| 5 | Compliance scan timeout | 技術 | 需拆分執行 |
| 6 | 14 訊息平台未全部實際測試 | 功能 | 需逐一驗證 |
| 7 | py_backup/ 含重複舊檔案 | 維護 | 建議清理 |

---

*SEOBAIKE — 專利 TW-115100981 | 小路光有限公司*
