-- ============================================================
-- 修復專利表 Performance WARN：
-- auth_rls_initplan: auth.uid() → (select auth.uid())
-- multiple_permissive_policies: 合併重複 SELECT policies
-- Migration: 20260212105921_fix_patent_performance_warnings
-- ============================================================

-- 1. constraint_paths: 修復 auth_rls_initplan + 合併 SELECT
DROP POLICY cp_all_admin ON constraint_paths;
DROP POLICY cp_select_authenticated ON constraint_paths;

CREATE POLICY cp_select_authenticated ON constraint_paths
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY cp_manage_admin ON constraint_paths
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- 2. jurisdiction_boundaries: 修復 auth_rls_initplan + 合併 SELECT
DROP POLICY jb_all_admin ON jurisdiction_boundaries;
DROP POLICY jb_select_authenticated ON jurisdiction_boundaries;

CREATE POLICY jb_select_authenticated ON jurisdiction_boundaries
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY jb_manage_admin ON jurisdiction_boundaries
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- 3. inference_path_checks: 修復 auth_rls_initplan
DROP POLICY ipc_insert_admin ON inference_path_checks;

CREATE POLICY ipc_insert_admin ON inference_path_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- 4. drift_detection_log: 修復 auth_rls_initplan
DROP POLICY ddl_insert_admin ON drift_detection_log;

CREATE POLICY ddl_insert_admin ON drift_detection_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- 5. reference_layer_locks: 修復 auth_rls_initplan + 合併 SELECT
DROP POLICY rll_manage_admin ON reference_layer_locks;
DROP POLICY rll_select_authenticated ON reference_layer_locks;

CREATE POLICY rll_select_authenticated ON reference_layer_locks
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY rll_manage_admin ON reference_layer_locks
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- 6. inference_audit_trail: 修復 auth_rls_initplan
DROP POLICY iat_insert_admin ON inference_audit_trail;

CREATE POLICY iat_insert_admin ON inference_audit_trail
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );
