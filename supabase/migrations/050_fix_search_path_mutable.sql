-- ============================================================
-- Migration 050: 修復所有 function_search_path_mutable 安全警告
-- 問題：以下函數有 SECURITY DEFINER 但缺少 SET search_path
--       Supabase Advisor 會將其標記為 medium security risk
-- 修復：ALTER FUNCTION ... SET search_path = 'public'
-- ============================================================

-- 1. generate_iso42001_evidence_package (migration 041)
ALTER FUNCTION generate_iso42001_evidence_package()
  SET search_path = 'public';

-- 2. get_compliance_badge_data (migration 041)
ALTER FUNCTION get_compliance_badge_data()
  SET search_path = 'public';

-- 3. call_opus_gpu (migration 047/048) — TEXT, TEXT, JSONB
ALTER FUNCTION call_opus_gpu(TEXT, TEXT, JSONB)
  SET search_path = 'public';

-- 4. stress_cloudflare_edge (migration 047/048) — UUID, TEXT
ALTER FUNCTION stress_cloudflare_edge(UUID, TEXT)
  SET search_path = 'public';

-- 5. get_user_recommendations_insane_v6 (migration 047/048) — UUID
ALTER FUNCTION get_user_recommendations_insane_v6(UUID)
  SET search_path = 'public';

-- 6. get_gpu_utilization (migration 047/048) — no SECURITY DEFINER but fix for completeness
ALTER FUNCTION get_gpu_utilization()
  SET search_path = 'public';

-- 7. compliance_grade (migration 040) — int -> text
ALTER FUNCTION compliance_grade(int)
  SET search_path = 'public';

-- ============================================================
-- 驗證
-- ============================================================
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*)
  INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND (pg_catalog.pg_get_function_identity_arguments(p.oid) IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM pg_options_to_table(p.proconfig)
      WHERE option_name = 'search_path'
    );

  IF v_count > 0 THEN
    RAISE NOTICE '⚠ 仍有 % 個 SECURITY DEFINER 函數缺少 search_path', v_count;
  ELSE
    RAISE NOTICE '✅ 所有 SECURITY DEFINER 函數已加 search_path 保護';
  END IF;
END;
$$;
