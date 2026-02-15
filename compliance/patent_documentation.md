# 專利 TW-115100981 約束層文件

**日期**：2026-02-15 | **公司**：小路光有限公司 | **CEO**：許竣翔

---

## 一、專利概要

| 項目 | 內容 |
|------|------|
| 專利號 | TW-115100981 |
| 專利名稱 | 世界定義約束法用於 AI 推理 |
| 申請人 | 小路光有限公司（統編 60475510） |
| 發明人 | 許竣翔 |
| 核心架構 | CaaS（Constraint-as-a-Service） |

## 二、L1-L4 約束層架構

### 層級定義

| 層 | 表名 | 記錄數 | 功能 |
|----|------|--------|------|
| L1 | l1_categories | 26 | 宏觀產業類別 |
| L2 | l2_subcategories | 100 | 次產業分類（FK → L1） |
| L3 | l3_processes | 226 | 製程/作業類型（FK → L2） |
| L4 | l4_nodes | 414 | 原子級工業節點（FK → L3） |
| **合計** | — | **766** | 四層完整約束鏈 |

### 多國對齊欄位

每層均內建：
- `tsic_code` — 台灣標準產業分類
- `naics_code` — 北美產業分類系統
- `nace_code` — 歐盟經濟活動分類
- `jsic_code` — 日本標準產業分類

### 凍結機制

- 每層具有 `is_frozen` + `frozen_at` 欄位
- `frozen_snapshots` 表保存不可修改的版本快照
- RLS 政策限制：僅 boss 角色可 INSERT 快照，任何人不可 UPDATE/DELETE
- 資料庫 trigger 保護凍結記錄不被修改

## 三、推理路徑約束

```
check_inference_path() 驗證流程：
L1 → L2 → L3 → L4

結果：
- allowed（允許）→ 可執行
- denied（禁止）→ 死亡，不可執行
- halted/rollback（走錯）→ 死亡，不可執行
- 無對應路徑 → 死亡，不可執行
```

## 四、稽核軌跡

| 表名 | 記錄數 | 用途 |
|------|--------|------|
| inference_audit_trail | 39,101 筆 | AI 推理路徑稽核紀錄 |
| ddl_audit_log | 825 筆 | 資料庫結構變更紀錄 |

## 五、驗證 SQL

```sql
-- 約束層完整性
SELECT 'L1' as layer, COUNT(*) FROM l1_categories
UNION ALL SELECT 'L2', COUNT(*) FROM l2_subcategories
UNION ALL SELECT 'L3', COUNT(*) FROM l3_processes
UNION ALL SELECT 'L4', COUNT(*) FROM l4_nodes;

-- 凍結狀態
SELECT id, code, name_zh, is_frozen, frozen_at
FROM l1_categories
ORDER BY id;

-- 推理稽核軌跡
SELECT COUNT(*) FROM inference_audit_trail;
```

---

*SEOBAIKE — 專利 TW-115100981 | 小路光有限公司*
