-- ============================================================
-- 修復 Security Advisor WARN：
-- 1. check_inference_path search_path 設定
-- 2. drift_detection_log / inference_path_checks INSERT policy 收緊
-- Migration: 20260212094027_fix_patent_tables_security_warnings
-- ============================================================

-- 1. 修復 function search_path
ALTER FUNCTION check_inference_path(text, uuid, uuid, uuid, uuid, jsonb) SET search_path = '';

-- 2. 收緊 inference_path_checks INSERT policy
--    只允許 admin/boss/president 直接 INSERT（函數用 SECURITY DEFINER 不受 RLS 限制）
DROP POLICY ipc_insert_authenticated ON inference_path_checks;
CREATE POLICY ipc_insert_admin
  ON inference_path_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  );

-- 3. 收緊 drift_detection_log INSERT policy
DROP POLICY ddl_insert_authenticated ON drift_detection_log;
CREATE POLICY ddl_insert_admin
  ON drift_detection_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  );
