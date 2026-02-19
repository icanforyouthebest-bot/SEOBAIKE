# AI Empire Knowledge Base — Supabase 安全問題

> 自動生成 + 人工補充。每次修復後更新此文件。
> 讓 AI CTO 在遇到新問題時優先查詢此知識庫。

---

## 問題分類總覽

| 問題類型 | 嚴重度 | 數量 | 狀態 | 難度 |
|----------|--------|------|------|------|
| security_definer_view | ERROR | 13 | pending manual | high |
| function_search_path_mutable | WARN | ~50 | pending | medium |
| extension_in_public | WARN | 2 | pending manual | high |
| rls_policy_always_true | WARN | ~20 | pending | medium |
| rls_enabled_no_policy | INFO | ~100 | ok (by design) | low |

---

## 問題 1：security_definer_view (ERROR)

### 根因分析
視圖（VIEW）使用 `SECURITY DEFINER` 模式，會以視圖建立者的權限執行查詢，
而非查詢者的權限。攻擊者可能透過視圖存取他們原本無權存取的資料。

### 已知受影響視圖（截至 2026-02-19 Supabase lint 結果）
包含但不限於：
- `public` schema 下的 13 個視圖

### 修復策略
**難度：HIGH — 需手動處理**

1. 查詢受影響視圖：
```sql
SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%security definer%';
```

2. 對每個視圖，重建為不使用 SECURITY DEFINER：
```sql
-- 先記下視圖定義，再重建
CREATE OR REPLACE VIEW public.view_name
WITH (security_invoker = true)
AS <original_query>;
```

3. 若視圖需要存取 private 資料，改用 Row-Level Security 控制。

### 驗證方法
```sql
SELECT viewname FROM pg_views
WHERE schemaname = 'public'
  AND definition ILIKE '%security definer%';
-- 結果應為空
```

### 注意事項
- 重建視圖前先備份現有定義
- 測試所有依賴此視圖的 API 和函數是否正常運作
- 分批修復，每次修復後驗證功能

---

## 問題 2：function_search_path_mutable (WARN)

### 根因分析
函數未設定固定的 `search_path`，攻擊者可以在公開 schema 中建立同名物件，
透過 search_path 劫持（schema injection）攻擊，讓函數執行惡意代碼。

### 修復策略
**難度：MEDIUM — 可自動批次修復**

批次修復 SQL（AI CTO 可自動執行）：
```sql
-- 查詢所有受影響函數
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc_info pi
    WHERE pi.prooid = p.oid
      AND pi.config @> ARRAY['search_path']
  );
```

為每個函數加入 SET search_path：
```sql
ALTER FUNCTION public.function_name(arg_types) SET search_path = '';
```

### AI 自動修復流程
1. `fetch_supabase_lint` → 取得受影響函數清單
2. 對每個函數呼叫 `execute_sql_on_supabase`：
   ```sql
   ALTER FUNCTION public.{func_name}({args}) SET search_path = '';
   ```
3. 呼叫 `mark_repair` 記錄每個函數的修復狀態

### 驗證方法
重新執行 lint 確認 `function_search_path_mutable` 警告數量減少

---

## 問題 3：extension_in_public (WARN)

### 根因分析
`vector` 和 `hstore` 擴充功能安裝在 `public` schema，
公開 schema 對所有用戶可見，可能被惡意利用。

### 已知受影響擴充
- `vector` — pgvector 向量搜尋
- `hstore` — Key-value 儲存

### 修復策略
**難度：HIGH — 影響廣，需手動處理**

建議做法：
1. 建立 `extensions` schema
2. 將擴充功能移至 `extensions` schema
3. 更新所有引用路徑

```sql
-- 建立 extensions schema（若不存在）
CREATE SCHEMA IF NOT EXISTS extensions;

-- 注意：移動擴充不能直接 ALTER，需要重建
-- 先評估影響範圍，再安排維護時窗
```

**暫時緩解**：確保 `public` schema 的 `USAGE` 權限只授予需要的角色

---

## 問題 4：rls_policy_always_true (WARN)

### 根因分析
RLS 政策條件為 `(true)` 或恆為 true 的表達式，
等同於對所有人開放，失去 RLS 的保護效果。

### 修復策略
**難度：MEDIUM — 需了解業務邏輯再修復**

查詢恆為 true 的政策：
```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE qual = '(true)' OR with_check = '(true)';
```

根據業務邏輯替換為有意義條件，例如：
```sql
-- 原始：允許所有人讀取
CREATE POLICY "allow_all" ON public.table_name FOR SELECT USING (true);

-- 修復後：只允許認證用戶讀取自己的資料
DROP POLICY "allow_all" ON public.table_name;
CREATE POLICY "allow_own" ON public.table_name
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 問題 5：rls_enabled_no_policy (INFO)

### 根因分析
資料表已啟用 RLS 但沒有任何政策，
預設行為是**拒絕所有存取**（安全但可能導致功能失效）。

### 評估
**INFO 等級 — 通常不需修復**

這是一個設計選擇：如果表是內部表，只由 service_role 存取，
拒絕所有 JWT 用戶存取是正確的行為。

### 何時需要修復
- 若 API 返回空資料或 403，且此表應該可被查詢
- 若需要授予特定角色存取

### 修復範本
```sql
-- 授予認證用戶讀取自己的資料
CREATE POLICY "allow_own_read" ON public.table_name
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 授予匿名用戶讀取公開資料
CREATE POLICY "allow_public_read" ON public.table_name
  FOR SELECT TO anon
  USING (is_public = true);
```

---

## Cloudflare 安全問題

### CF-003：SSL 弱模式
- **根因**：SSL 未設為 Full (Strict)，流量可能被中間人攻擊
- **修復**：`PATCH /zones/{id}/settings/ssl` with `{"value": "strict"}`
- **難度**：LOW — AI 可自動修復

### CF-004：無 WAF 規則
- **根因**：未設定防火牆規則，惡意流量未被過濾
- **修復**：建立 managed_challenge for threat_score > 30
- **難度**：LOW — AI 可自動修復

---

## GitHub 安全問題

### GH-001：Public Repository
- **根因**：程式碼公開（可能含敏感設定）
- **修復**：需手動在 GitHub Settings 改為 Private
- **難度**：HIGH — 業務決策，不自動修復

### GH-002：無 Branch Protection
- **根因**：master 分支可直接推送，無 review 要求
- **修復**：GitHub API 設定 branch protection rules
- **難度**：MEDIUM — AI 可建立 Issue 追蹤

---

## 修復記錄

| 日期 | 問題 ID | 執行的修復 | 結果 |
|------|---------|-----------|------|
| 2026-02-20 | - | 初始化知識庫 | N/A |

---

## 下次 AI CTO 執行時的查詢指引

遇到新問題時，先在此文件搜尋：
1. 問題是否已記錄在案？
2. 根因是否相同？
3. 是否有已驗證的修復策略？
4. 以前嘗試過的方法是否失敗？

若知識庫無記錄，執行修復後**必須更新此文件**。
