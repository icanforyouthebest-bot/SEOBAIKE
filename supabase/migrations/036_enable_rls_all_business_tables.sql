-- ============================================================
-- Migration 036: 全面啟用 RLS — 所有業務表
-- 啟用 RLS 但不建立 policy = 只有 service_role 可存取
-- ============================================================

DO $$
DECLARE
  v_table text;
  v_count int := 0;
BEGIN
  FOR v_table IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND rowsecurity = false
      AND tablename NOT LIKE 'schema_%'
      AND tablename NOT LIKE 'supabase_%'
      AND tablename NOT LIKE '%_old'
      AND tablename NOT LIKE '%_2026_%'
      AND tablename NOT LIKE '%_default'
      AND tablename NOT IN (
        'spatial_ref_sys','geography_columns','geometry_columns',
        'stress_test_results','neural_sync_stream'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    v_count := v_count + 1;
    RAISE NOTICE '  RLS enabled: %', v_table;
  END LOOP;

  RAISE NOTICE '=== Migration 036: 已對 % 張表啟用 RLS ===', v_count;
END;
$$;

-- 驗證：重新掃描
DO $$
DECLARE v_scan jsonb;
BEGIN
  v_scan := run_security_scan();
  RAISE NOTICE '=== 掃描結果 ===';
  RAISE NOTICE '分數: %/100', v_scan->>'score';
  RAISE NOTICE 'Go/No-Go: %', v_scan->>'go_no_go';
  RAISE NOTICE '通過: %, 失敗: %, 警告: %', v_scan->>'passed', v_scan->>'failed', v_scan->>'warnings';
END;
$$;
