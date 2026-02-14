-- ============================================================
-- Migration 021: 鎖定所有工程師
-- admin/president/moderator/user 對核心表全面禁寫
-- 只有 boss 可以寫入 operator 規則
-- 只有 regulator 可以寫入 government 規則
-- Migration: 20260212140722_lock_all_engineers
-- ============================================================

-- 暫時停用 DDL 守衛（要修改被保護表的 policy）
ALTER EVENT TRIGGER govt_ddl_guard DISABLE;
ALTER EVENT TRIGGER govt_drop_guard DISABLE;

-- ============================================================
-- 1. constraint_paths：移除 admin/president，只留 boss
-- ============================================================
DROP POLICY IF EXISTS cp_insert_operator ON constraint_paths;
CREATE POLICY cp_insert_boss ON constraint_paths
  FOR INSERT TO authenticated
  WITH CHECK (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

DROP POLICY IF EXISTS cp_update_operator ON constraint_paths;
CREATE POLICY cp_update_boss ON constraint_paths
  FOR UPDATE TO authenticated
  USING (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  )
  WITH CHECK (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

DROP POLICY IF EXISTS cp_delete_operator ON constraint_paths;
CREATE POLICY cp_delete_boss ON constraint_paths
  FOR DELETE TO authenticated
  USING (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

-- ============================================================
-- 2. jurisdiction_boundaries：移除 admin/president，只留 boss
-- ============================================================
DROP POLICY IF EXISTS jb_insert_operator ON jurisdiction_boundaries;
CREATE POLICY jb_insert_boss ON jurisdiction_boundaries
  FOR INSERT TO authenticated
  WITH CHECK (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

DROP POLICY IF EXISTS jb_update_operator ON jurisdiction_boundaries;
CREATE POLICY jb_update_boss ON jurisdiction_boundaries
  FOR UPDATE TO authenticated
  USING (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  )
  WITH CHECK (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

DROP POLICY IF EXISTS jb_delete_operator ON jurisdiction_boundaries;
CREATE POLICY jb_delete_boss ON jurisdiction_boundaries
  FOR DELETE TO authenticated
  USING (
    authority = 'operator'
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

-- ============================================================
-- 3. frozen_snapshots：只有 boss 可以新增快照
-- ============================================================
DROP POLICY IF EXISTS frozen_snapshots_insert ON frozen_snapshots;
CREATE POLICY frozen_snapshots_insert_boss ON frozen_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

-- ============================================================
-- 4. user_roles：只有 boss 可以管理角色（新增/修改/刪除）
-- ============================================================
CREATE POLICY ur_insert_boss ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

CREATE POLICY ur_update_boss ON user_roles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

CREATE POLICY ur_delete_boss ON user_roles
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = (select auth.uid()) AND role = 'boss')
  );

-- ============================================================
-- 5. 重新啟用 DDL 守衛
-- ============================================================
ALTER EVENT TRIGGER govt_ddl_guard ENABLE;
ALTER EVENT TRIGGER govt_drop_guard ENABLE;
