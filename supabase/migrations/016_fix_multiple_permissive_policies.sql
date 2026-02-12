-- ============================================================
-- 修復 multiple_permissive_policies：
-- 將 FOR ALL admin policy 拆為 INSERT/UPDATE/DELETE
-- 避免與 FOR SELECT 重疊
-- Migration: 20260212110000_fix_multiple_permissive_policies
-- ============================================================

-- 1. constraint_paths
DROP POLICY cp_manage_admin ON constraint_paths;

CREATE POLICY cp_insert_admin ON constraint_paths
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

CREATE POLICY cp_update_admin ON constraint_paths
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

CREATE POLICY cp_delete_admin ON constraint_paths
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- 2. jurisdiction_boundaries
DROP POLICY jb_manage_admin ON jurisdiction_boundaries;

CREATE POLICY jb_insert_admin ON jurisdiction_boundaries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

CREATE POLICY jb_update_admin ON jurisdiction_boundaries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

CREATE POLICY jb_delete_admin ON jurisdiction_boundaries
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

-- 3. reference_layer_locks
DROP POLICY rll_manage_admin ON reference_layer_locks;

CREATE POLICY rll_insert_admin ON reference_layer_locks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

CREATE POLICY rll_update_admin ON reference_layer_locks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );

CREATE POLICY rll_delete_admin ON reference_layer_locks
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role IN ('admin', 'boss', 'president'))
  );
