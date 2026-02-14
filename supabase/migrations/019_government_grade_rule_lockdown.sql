-- ============================================================
-- Migration 018b: 政府級規則鎖死
-- 工程師/admin 永遠無法碰政府設定的約束規則
-- 雙層防護：RLS + Trigger（即使 SECURITY DEFINER 也擋）
-- Migration: 20260212120838_government_grade_rule_lockdown
-- ============================================================

-- 1. constraint_paths 加 authority 欄位
ALTER TABLE constraint_paths
  ADD COLUMN authority text NOT NULL DEFAULT 'operator'
  CHECK (authority IN ('government', 'operator'));

-- 2. jurisdiction_boundaries 加 authority 欄位
ALTER TABLE jurisdiction_boundaries
  ADD COLUMN authority text NOT NULL DEFAULT 'operator'
  CHECK (authority IN ('government', 'operator'));

-- 3. Trigger：政府規則不可改不可刪（連 SECURITY DEFINER 都擋）
CREATE OR REPLACE FUNCTION protect_government_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.authority = 'government' THEN
    RAISE EXCEPTION 'BLOCKED: Government-defined rules are immutable. Cannot % authority=government row.', TG_OP;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.authority = 'government' AND OLD.authority = 'operator' THEN
    RAISE EXCEPTION 'BLOCKED: Cannot escalate operator rule to government authority.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- 4. 掛 trigger
CREATE TRIGGER trg_protect_gov_constraint_paths
  BEFORE UPDATE OR DELETE ON constraint_paths
  FOR EACH ROW EXECUTE FUNCTION protect_government_rules();

CREATE TRIGGER trg_protect_gov_jurisdiction_boundaries
  BEFORE UPDATE OR DELETE ON jurisdiction_boundaries
  FOR EACH ROW EXECUTE FUNCTION protect_government_rules();

-- ============================================================
-- 5. RLS 重建：constraint_paths
-- ============================================================
DROP POLICY IF EXISTS cp_insert_admin ON constraint_paths;

CREATE POLICY cp_insert_operator ON constraint_paths
  FOR INSERT TO authenticated
  WITH CHECK (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

CREATE POLICY cp_insert_government ON constraint_paths
  FOR INSERT TO authenticated
  WITH CHECK (
    authority = 'government'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'regulator')
  );

DROP POLICY IF EXISTS cp_update_admin ON constraint_paths;

CREATE POLICY cp_update_operator ON constraint_paths
  FOR UPDATE TO authenticated
  USING (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

DROP POLICY IF EXISTS cp_delete_admin ON constraint_paths;

CREATE POLICY cp_delete_operator ON constraint_paths
  FOR DELETE TO authenticated
  USING (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- ============================================================
-- 6. RLS 重建：jurisdiction_boundaries
-- ============================================================
DROP POLICY IF EXISTS jb_insert_admin ON jurisdiction_boundaries;

CREATE POLICY jb_insert_operator ON jurisdiction_boundaries
  FOR INSERT TO authenticated
  WITH CHECK (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

CREATE POLICY jb_insert_government ON jurisdiction_boundaries
  FOR INSERT TO authenticated
  WITH CHECK (
    authority = 'government'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'regulator')
  );

DROP POLICY IF EXISTS jb_update_admin ON jurisdiction_boundaries;

CREATE POLICY jb_update_operator ON jurisdiction_boundaries
  FOR UPDATE TO authenticated
  USING (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

DROP POLICY IF EXISTS jb_delete_admin ON jurisdiction_boundaries;

CREATE POLICY jb_delete_operator ON jurisdiction_boundaries
  FOR DELETE TO authenticated
  USING (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );
