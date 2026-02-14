-- 035: Diagnostic — show detailed scan findings
DO $$
DECLARE
  v_scan jsonb;
  v_finding jsonb;
  v_tables text;
BEGIN
  v_scan := run_security_scan();
  RAISE NOTICE 'Score: %/100 | Go/No-Go: % | P:% F:% W:%',
    v_scan->>'score', v_scan->>'go_no_go',
    v_scan->>'passed', v_scan->>'failed', v_scan->>'warnings';

  FOR v_finding IN SELECT * FROM jsonb_array_elements(v_scan->'findings')
  LOOP
    RAISE NOTICE '[%] % — %',
      v_finding->>'result',
      v_finding->>'check',
      v_finding->>'detail';
  END LOOP;

  -- Show tables without RLS that aren't excluded
  SELECT string_agg(tablename, ', ' ORDER BY tablename)
  INTO v_tables
  FROM pg_tables
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
    );
  RAISE NOTICE 'Tables without RLS (after exclusions): %', v_tables;
END;
$$;
