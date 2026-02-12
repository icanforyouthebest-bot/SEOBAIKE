# SEOBAIKE System Status Report

**系統狀態報告**

- 日期：2025-02-12
- 專案：SEOBAIKE（AI 界的 App Store）
- Supabase Project Ref：vmyrivxxibqydccurxug（東京）
- 架構師：許竣翔
- 公司：小路光有限公司（統編 60475510）
- 專利：台灣專利 115100981「世界定義約束法用於AI推理」

---

## 1. Security Advisor 結果

| 等級 | 數量 | 說明 |
|------|------|------|
| ERROR | **0** | 無任何錯誤 |
| WARN | **1** | Auth Leaked Password Protection（Dashboard 設定） |
| INFO | 82 | RLS enabled but no policy（舊表 default-deny，安全） |

**WARN 明細：**

| 項目 | 狀態 | 修復方式 |
|------|------|---------|
| ~~function_search_path_mutable (x10)~~ | 已修復 (migration 009) | ALTER FUNCTION SET search_path |
| ~~extension_in_public (pg_trgm)~~ | 已修復 (migration 009) | ALTER EXTENSION SET SCHEMA extensions |
| ~~rls_policy_always_true (frozen_snapshots)~~ | 已修復 (migration 009) | WITH CHECK (auth.uid() IS NOT NULL) |
| auth_leaked_password_protection | 待處理 | Dashboard → Auth → Settings → 啟用 |

---

## 2. Tables 總覽

| 指標 | 數值 |
|------|------|
| 總 Table 數 | **176** |
| RLS 已啟用 | **176**（100%） |
| RLS 未啟用 | **0** |
| 有 RLS Policy 的 Table | **81** |
| 僅 RLS default-deny 的 Table | **95**（舊表，僅 service_role 可存取） |

### 專利 L1-L4 約束層資料量

| Layer | Table | Records |
|-------|-------|---------|
| L1 | l1_categories | **21** |
| L2 | l2_subcategories | **85** |
| L3 | l3_processes | **207** |
| L4 | l4_nodes | **414** |
| Snapshot | frozen_snapshots | **1**（v1.0.0） |
| **合計** | | **728** |

---

## 3. Edge Functions

| 指標 | 數值 |
|------|------|
| 總 Edge Function 數 | **68** |
| 狀態 ACTIVE | **68**（100%） |
| verify_jwt = true | 10 |
| verify_jwt = false | 58 |

**MCP 專利層 Edge Functions（本次新增）：**

| Function | verify_jwt | 用途 |
|----------|-----------|------|
| order-created | true | L3 訂單建立 → AML/KYC 檢查 |
| payment-captured | true | L3 付款完成 → 佣金計算 + 反回扣偵測 |

---

## 4. Migrations 清單

| # | Version | Name | 說明 |
|---|---------|------|------|
| 1 | 20260211150755 | l1_l4_constraint_layers | L1-L4 約束層 + frozen_snapshots |
| 2 | 20260211154354 | l1_l4_rls_and_function_security | L1-L4 RLS + trigger 保護 |
| 3 | 20260211155659 | business_logic_alter_and_create | 商業邏輯表（users, roles, orders 等） |
| 4 | 20260211155843 | business_kyc_aml_risk_compliance | KYC/AML/風險/合規表 |
| 5 | 20260211160028 | business_commission_clawback_antikickback | 佣金/追回/反回扣表 |
| 6 | 20260211161407 | business_aml_rules_alerts_cases | AML 規則/警報/案件表 |
| 7 | 20260211161538 | business_kyc_documents_verification | KYC 文件/驗證表 |
| 8 | 20260211163311 | business_tables_rls_policies | 商業表 RLS 政策 |
| 9 | 20260211185512 | fix_all_security_warnings | 修復全部 12 個 security warnings |

---

## 5. Database Functions

| 指標 | 數值 |
|------|------|
| 總 Function 數 | **81** |
| search_path LOCKED | **81**（100%） |
| search_path MUTABLE | **0** |
| SECURITY DEFINER | 49 |
| SECURITY INVOKER | 32 |

---

## 6. Extensions

| Extension | Schema | 說明 |
|-----------|--------|------|
| plpgsql | pg_catalog | PL/pgSQL 語言 |
| uuid-ossp | extensions | UUID 生成 |
| pgcrypto | extensions | 加密函數 |
| pg_trgm | extensions | 三元組相似度（已從 public 移入） |
| pg_stat_statements | extensions | 查詢統計 |
| pg_graphql | graphql | GraphQL 引擎 |
| supabase_vault | vault | 密鑰保管庫 |

---

## 7. Shared Modules（_shared/）

| Module | Layer | 用途 |
|--------|-------|------|
| compliance_tw.ts | L4 | 台灣法遵規則引擎 |
| aml_engine.ts | L3 | AML 交易過濾引擎 |
| aml_monitoring.ts | L3 | AML 即時監控規則 |
| kyc_engine.ts | L3 | KYC 風險評分引擎 |
| kyc_verification.ts | L3 | KYC 文件驗證模組 |
| kyc_risk_scoring.ts | L3 | KYC 風險因子評分模型 |

---

## 8. Seeds（資料種子）

| # | Seed | Records | 說明 |
|---|------|---------|------|
| 1 | 001_l1_categories | 21 | 宏觀產業類別 |
| 2 | 002_l2_subcategories | 85 | 次產業分類 |
| 3 | 003_l3_processes | 207 | 製程/作業類型 |
| 4 | 004_l4_nodes | 414 | 原子級工業節點 |
| 5 | 005_aml_rules | 16 | AML 規則 |
| 6 | 006_legal_references_tw | 18 | 台灣法規參照 |
| 7 | 007_anti_kickback_contracts | 8 | 反回扣合約範本 |
| | **合計** | **769+** | |

---

## 9. Documentation（supabase/docs/）

| 類別 | 數量 | 說明 |
|------|------|------|
| Audit/Brand Wall | 33 | audit_00 ~ audit_32（黑金 A1 版） |
| Formal Audit | 4 | formal_01 ~ formal_04（正式審計文件） |
| Engineering Docs | 4 | mapping, audit-ready, policy, SOP |
| **合計** | **41** | |

**正式審計文件：**

| # | 文件 | 用途 |
|---|------|------|
| 1 | formal_01_audit_report_pdf.md | 審計 PDF 版 |
| 2 | formal_02_technical_audit_spec.md | 審計技術版 |
| 3 | formal_03_fsc_examination.md | 金管會查核版 |
| 4 | formal_04_iso27001_mapping.md | ISO 27001:2022 對應矩陣（93 controls） |

---

## 10. Test/Reference Scripts（supabase/tests/）

| Script | Layer | 用途 |
|--------|-------|------|
| test_aml_kyc_l4.py | L4 | AML/KYC 單元測試 |
| audit_log_script_l4.py | L4 | 審計日誌腳本 |
| oauth_mcp_example_l4.py | L4 | OAuth MCP 參考實作 |
| ci_cd_pipeline_l4.yml | L4 | GitHub Actions CI/CD |
| sca_sbom_scan_l4.py | L4 | SCA/SBOM 掃描 |
| incident_report_l4.py | L4 | 事件通報腳本 |

---

## 11. RLS Policy 分佈（有 Policy 的 Table，前 20）

| Table | Policies | 說明 |
|-------|----------|------|
| sites | 9 | 網站管理 |
| ai_tasks | 8 | AI 任務佇列 |
| orders | 8 | 訂單 |
| pages | 7 | 頁面 |
| profiles | 7 | 用戶檔案 |
| websites | 7 | 網站 |
| ai_context | 6 | AI 上下文 |
| ai_logs | 6 | AI 日誌 |
| assets | 6 | 資產 |
| boss_sync_context | 6 | Boss 同步 |
| order_items | 6 | 訂單項目 |
| invoices | 5 | 發票 |
| payment_intents | 5 | 付款意圖 |
| payment_txns | 5 | 付款交易 |
| seo_bases | 5 | SEO 基礎 |
| system_logs | 5 | 系統日誌 |
| user_roles_v2 | 5 | 用戶角色 v2 |
| l1_categories | 4 | L1 產業類別 |
| l2_subcategories | 4 | L2 次分類 |
| l3_processes | 4 | L3 製程 |

---

## 12. 整體健康度

```
+---------------------------+--------+
| 指標                      | 狀態   |
+---------------------------+--------+
| Security ERROR            | 0      |
| Security WARN (SQL)       | 0 / 12 |
| Security WARN (Auth)      | 1 *    |
| Tables RLS 100%           | PASS   |
| Functions search_path     | 100%   |
| Extensions not in public  | PASS   |
| L1-L4 Data Frozen         | v1.0.0 |
| Edge Functions ACTIVE     | 68/68  |
| Migrations Applied        | 9/9    |
+---------------------------+--------+
* Auth Leaked Password Protection 需至 Dashboard 啟用
```

---

> SEOBAIKE / 小路光有限公司 / 許竣翔
> 台灣專利 115100981「世界定義約束法用於AI推理」
> Generated: 2025-02-12
