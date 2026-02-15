# SEOBAIKE 總部各部門專屬資料包

**日期**：2026-02-15
**專利**：TW-115100981 | **公司**：小路光有限公司 | **CEO**：許竣翔
**用途**：各部門依職責取用對應資料包

---

## 總覽

| 資料包 | 對應部門 | 包含文件數 | 主要用途 |
|--------|---------|-----------|---------|
| 法務包 | 法務部 | 6 份 | 專利保護、合規審查 |
| 資安包 | 資安部 | 5 份 | 安全檢測、稽核軌跡 |
| 研發包 | 研發部 | 8 份 | 技術架構、平台目錄 |
| 營運包 | 營運部 | 5 份 | 營運指標、部署狀態 |
| 稽核包 | 稽核部 | 7 份 | 完整性驗證、誠實揭露 |

---

## 一、法務包（法務部門）

### 用途
保護專利 TW-115100981、證明 L1-L4 約束層完整性、合規審查。

### 包含文件

| # | 文件 | 路徑 | 說明 |
|---|------|------|------|
| 1 | 專利約束層數據 | Supabase: l1~l4 表 | L1: 26, L2: 100, L3: 226, L4: 414 筆 |
| 2 | 版本快照 | Supabase: frozen_snapshots | 不可修改的歷史版本 |
| 3 | 白皮書 | docs/white_paper.md | 14,499 B — 專利技術說明 |
| 4 | 防禦策略 | docs/defense_strategy.md | 24,608 B — 專利防禦方案 |
| 5 | 合規掃描紀錄 | Supabase: ai_compliance_findings | 1,980 筆掃描結果 |
| 6 | 合規稽核報告 | Supabase: compliance_audit_reports | 120 份報告 |

### 法務查詢 SQL

```sql
-- 專利約束層完整性確認
SELECT 'L1' as layer, COUNT(*) FROM l1_categories
UNION ALL SELECT 'L2', COUNT(*) FROM l2_subcategories
UNION ALL SELECT 'L3', COUNT(*) FROM l3_processes
UNION ALL SELECT 'L4', COUNT(*) FROM l4_nodes;

-- 凍結狀態確認
SELECT id, name, is_frozen, frozen_at FROM l1_categories WHERE is_frozen = true;
```

---

## 二、資安包（資安部門）

### 用途
安全漏洞評估、稽核軌跡查閱、安全改善追蹤。

### 包含文件

| # | 文件 | 路徑 | 說明 |
|---|------|------|------|
| 1 | 安全檢測腳本 | self_audit.py | 10/10 項全部真正實作 |
| 2 | 安全檢測報告 | tasks/security_audit_report.json | 真實分數 72/100 (C) |
| 3 | 安全稽核文件 | docs/security_audit_self.md | 18,163 B |
| 4 | 推理稽核軌跡 | Supabase: inference_audit_trail | 39,101 筆 |
| 5 | DDL 稽核日誌 | Supabase: ddl_audit_log | 825 筆 |

### 安全分數詳情

| 檢查項 | 狀態 | 扣分 |
|--------|------|------|
| VULN-001 Prompt Injection | SAFE | 0 |
| VULN-002 API 金鑰洩漏 | VULNERABLE | -15 |
| VULN-003 資料外洩 | VULNERABLE | -10 |
| VULN-004 權限提升 | SAFE | 0 |
| VULN-005 SQL Injection | SAFE | 0 |
| VULN-006 DoS 攻擊 | SAFE | 0 |
| VULN-007 日誌注入 | SAFE | 0 |
| VULN-008 依賴套件 | SAFE | 0 |
| VULN-009 XSS | SAFE | 0 |
| VULN-010 不安全隨機數 | VULNERABLE | -3 |
| **總分** | — | **72/100** |

### 優先修復建議

1. 將所有 HTML 檔案中的 JWT token 移至環境變數（VULN-002，-15 分）
2. 清理測試檔案中的假身分證號/信用卡號（VULN-003，-10 分）
3. 將 random 替換為 secrets/crypto（VULN-010，-3 分）

---

## 三、研發包（研發部門）

### 用途
技術架構理解、程式碼維護、平台整合開發。

### 包含文件

| # | 文件 | 路徑 | 說明 |
|---|------|------|------|
| 1 | Workers 主程式 | workers/src/index.ts | 982 行，14 平台訊息處理 |
| 2 | Auth 中間件 | workers/src/middleware/auth.ts | 認證機制 |
| 3 | 平台目錄 | Supabase: ai_model_registry | 4,000 筆 / 2,760 供應商 |
| 4 | 連接器清單 | Supabase: platform_connectors | 61 個連接器 |
| 5 | 技術白皮書 | docs/white_paper.md | 架構說明 |
| 6 | 教學腳本 | docs/tutorial_script.txt | 開發教學 |
| 7 | 比較分析 | docs/comparative_analysis.md | 競品比較 |
| 8 | 未來路線圖 | docs/future_roadmap.md | 發展規劃 |

### 技術棧

| 組件 | 技術 | 狀態 |
|------|------|------|
| 中控台 | Claude Code (Opus 4.6) | 運作中 |
| 資料庫 | Supabase（東京） | 運作中 |
| API 層 | Cloudflare Workers | 已部署 |
| 前端 | Framer + Cloudflare Pages | 已部署 |
| 網域 | aiforseo.vip | 已設定 |

---

## 四、營運包（營運部門）

### 用途
日常營運監控、平台狀態、商業指標。

### 包含文件

| # | 文件 | 路徑 | 說明 |
|---|------|------|------|
| 1 | 平台目錄總覽 | docs/platform_registration_proof.md | 4,000 筆收錄清單 |
| 2 | 資料盤點報告 | docs/data_inventory_export.md | 完整資料清單 |
| 3 | 發布說明 | docs/release_notes.md | 版本更新紀錄 |
| 4 | 最終總結 | docs/final_summary.md | 專案總結 |
| 5 | 營運監控 | system-monitor.py | 系統監控腳本 |

### 營運指標

| 指標 | 數值 |
|------|------|
| 平台收錄數 | 4,000 |
| 供應商數 | 2,760 |
| 產業垂直覆蓋 | 150+ |
| 訊息平台支援 | 14 個 |
| DB 表數 | 277 |
| DB 記錄數 | 103,084+ |

---

## 五、稽核包（稽核部門）

### 用途
獨立驗證所有宣稱、識別虛報、確認完整性。

### 包含文件

| # | 文件 | 路徑 | 說明 |
|---|------|------|------|
| 1 | 資料完整性宣告 | data_integrity_declaration.md | 含「無法補齊」誠實揭露 |
| 2 | 完整性驗證腳本 | data_integrity_check.py | 28 項自動化檢查 |
| 3 | 完整性驗證報告 | data_integrity_report.json | 27 通過 / 0 失敗 / 1 警告 |
| 4 | Opus 4.6 十大缺點 | docs/opus46_top10_defects.md | 自我批判報告 |
| 5 | 安全檢測報告 | tasks/security_audit_report.json | 72/100 真實分數 |
| 6 | 平台收錄證明 | docs/platform_registration_proof.md | 含「非真正註冊」揭露 |
| 7 | 十層任務鏈驗證 | 22 個交付檔案 | SHA256 可驗證 |

### 關鍵誠實揭露摘要

| # | 揭露事項 | 影響 |
|---|---------|------|
| 1 | 4,000 平台是 SQL INSERT 非實際註冊 | 營銷用語需更正 |
| 2 | 安全分數從虛報 85 降為真實 72 | 安全評級降低 |
| 3 | L3 成功率 96% 為 random 模擬 | 執行數據不可靠 |
| 4 | Token 消耗 ~500K 為估計非精確 | 成本估算有誤差 |
| 5 | Compliance scan 因 timeout 無法完成 | 合規掃描不完整 |

---

## 六、文件索引（全部交付物）

| # | 文件名 | 部門 | 類型 |
|---|--------|------|------|
| 1 | self_audit.py | 資安 | 程式碼 |
| 2 | tasks/security_audit_report.json | 資安 | 報告 |
| 3 | data_integrity_declaration.md | 稽核 | 宣告 |
| 4 | data_integrity_check.py | 稽核 | 程式碼 |
| 5 | data_integrity_report.json | 稽核 | 報告 |
| 6 | docs/platform_registration_proof.md | 營運/稽核 | 說明 |
| 7 | docs/data_inventory_export.md | 全部門 | 盤點 |
| 8 | docs/opus46_top10_defects.md | 稽核 | 自評 |
| 9 | docs/layer5_plus_fix_report.md | 研發 | 分析 |
| 10 | docs/department_packages.md | 全部門 | 索引 |
| 11 | docs/white_paper.md | 法務/研發 | 白皮書 |
| 12 | docs/defense_strategy.md | 法務 | 防禦策略 |
| 13 | docs/security_audit_self.md | 資安 | 安全分析 |
| 14 | docs/comparative_analysis.md | 研發 | 比較分析 |
| 15 | docs/future_roadmap.md | 研發/營運 | 路線圖 |
| 16 | docs/release_notes.md | 營運 | 發布說明 |
| 17 | docs/final_summary.md | 全部門 | 專案總結 |

---

## 七、簽署

> **Opus 4.6 聲明**：
> 以上五個部門資料包已完整整理，每個部門可依索引取用所需文件。
> 所有「誠實揭露」事項均已包含在稽核包中。
>
> 簽署人：Opus 4.6 (Claude Code)
> 簽署時間：2026-02-15
> 專利：TW-115100981
> 公司：小路光有限公司
> CEO：許竣翔

---

*SEOBAIKE — AI 界的 App Store | 專利 TW-115100981 | 小路光有限公司*
