-- ============================================================
-- 將 patent_compliance_audit 表納入 migration 追蹤
-- 表已存在（之前透過 execute_sql 建立），此處用 IF NOT EXISTS
-- 同時修復 pca_insert policy 的 auth_rls_initplan 問題
-- Migration: 20260212112331_patent_compliance_audit_table
-- ============================================================

-- 1. 建表（IF NOT EXISTS，安全冪等）
CREATE TABLE IF NOT EXISTS patent_compliance_audit (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patent_number          text NOT NULL,
  audit_date             timestamptz DEFAULT now(),
  claim_number           integer,
  element_type           text NOT NULL CHECK (element_type IN ('claim', 'figure4')),
  element_name           text NOT NULL,
  required_artifacts     text NOT NULL,
  actual_artifacts       text NOT NULL,
  status                 text NOT NULL CHECK (status IN ('pass', 'gap', 'partial')),
  detail                 text,
  security_advisor_result text,
  audited_by             text DEFAULT 'claude-code'
);

-- 2. 啟用 RLS
ALTER TABLE patent_compliance_audit ENABLE ROW LEVEL SECURITY;

-- 3. 修復 pca_insert policy：auth.uid() → (select auth.uid())
DROP POLICY IF EXISTS pca_insert ON patent_compliance_audit;
CREATE POLICY pca_insert ON patent_compliance_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- 4. SELECT policy（冪等重建）
DROP POLICY IF EXISTS pca_select ON patent_compliance_audit;
CREATE POLICY pca_select ON patent_compliance_audit
  FOR SELECT TO authenticated
  USING (true);
