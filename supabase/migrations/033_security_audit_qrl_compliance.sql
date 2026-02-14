-- ============================================================
-- Migration 033: QRL 級安全掃描 + 合規審計
-- 全方位檢查 → go/no-go 上線決策閘門
-- ============================================================

-- 1. 審計報告表
CREATE TABLE IF NOT EXISTS compliance_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_type text NOT NULL CHECK (audit_type IN ('security_scan','qrl_compliance','pre_launch','post_launch')),
  overall_result text NOT NULL CHECK (overall_result IN ('pass','fail','warning')),
  score int CHECK (score >= 0 AND score <= 100),
  total_checks int NOT NULL DEFAULT 0,
  passed_checks int NOT NULL DEFAULT 0,
  failed_checks int NOT NULL DEFAULT 0,
  warning_checks int NOT NULL DEFAULT 0,
  findings jsonb NOT NULL DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  audited_by text DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE compliance_audit_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "car_service_all" ON compliance_audit_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. 全方位安全掃描 RPC
CREATE OR REPLACE FUNCTION run_security_scan()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_findings jsonb := '[]'::jsonb;
  v_pass int := 0;
  v_fail int := 0;
  v_warn int := 0;
  v_count int;
  v_result text;
  v_report_id uuid;
BEGIN
  -- ============================================================
  -- S1: RLS 啟用檢查（所有業務表必須啟用 RLS）
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_realtime%'
      AND rowsecurity = false;

  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S1_RLS', 'result', 'pass', 'detail', '所有表已啟用 RLS');
  ELSE
    v_fail := v_fail + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S1_RLS', 'result', 'fail',
      'detail', format('%s 張表未啟用 RLS', v_count));
  END IF;

  -- ============================================================
  -- S2: SECURITY DEFINER 函數檢查（必須設定 search_path）
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT (p.proconfig @> ARRAY['search_path=public']);

  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S2_SEARCH_PATH', 'result', 'pass',
      'detail', '所有 SECURITY DEFINER 函數已設定 search_path');
  ELSE
    v_warn := v_warn + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S2_SEARCH_PATH', 'result', 'warning',
      'detail', format('%s 個函數未設定 search_path', v_count));
  END IF;

  -- ============================================================
  -- S3: 權限分離檢查（founder 指令不能被 user 執行）
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM remote_command_templates
    WHERE requires_confirmation = true
      AND min_permission NOT IN ('founder');

  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S3_PERMISSION', 'result', 'pass',
      'detail', '所有高風險指令已鎖定為 founder');
  ELSE
    v_warn := v_warn + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S3_PERMISSION', 'result', 'warning',
      'detail', format('%s 個需確認指令非 founder 限定', v_count));
  END IF;

  -- ============================================================
  -- S4: 審批系統完整性
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM remote_command_templates
    WHERE command IN ('/approve','/reject','/pending')
      AND handler = 'approval-handler'
      AND is_enabled = true;

  IF v_count = 3 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S4_APPROVAL', 'result', 'pass',
      'detail', '審批系統 3 指令完整');
  ELSE
    v_fail := v_fail + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S4_APPROVAL', 'result', 'fail',
      'detail', format('審批指令只有 %s/3', v_count));
  END IF;

  -- ============================================================
  -- S5: AI 模型註冊完整性
  -- ============================================================
  SELECT count(*) INTO v_count FROM ai_model_registry WHERE is_available = true;

  IF v_count >= 27 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S5_MODELS', 'result', 'pass',
      'detail', format('%s 個模型已註冊', v_count));
  ELSE
    v_warn := v_warn + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S5_MODELS', 'result', 'warning',
      'detail', format('只有 %s 個模型（預期 27+）', v_count));
  END IF;

  -- ============================================================
  -- S6: 路由設定完整性
  -- ============================================================
  SELECT count(*) INTO v_count FROM ai_model_routing_config WHERE is_enabled = true;

  IF v_count >= 6 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S6_ROUTING', 'result', 'pass',
      'detail', format('%s 條路由啟用', v_count));
  ELSE
    v_warn := v_warn + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S6_ROUTING', 'result', 'warning',
      'detail', format('只有 %s 條路由', v_count));
  END IF;

  -- ============================================================
  -- S7: 專利 115100981 推理路徑函數存在
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'check_inference_path';

  IF v_count > 0 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S7_PATENT', 'result', 'pass',
      'detail', 'check_inference_path() 存在');
  ELSE
    v_fail := v_fail + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S7_PATENT', 'result', 'fail',
      'detail', 'check_inference_path() 不存在！專利合規失敗');
  END IF;

  -- ============================================================
  -- S8: AML 防洗錢系統
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('aml_rules','aml_alerts','aml_cases');

  IF v_count = 3 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S8_AML', 'result', 'pass',
      'detail', 'AML 三表完整');
  ELSE
    v_fail := v_fail + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S8_AML', 'result', 'fail',
      'detail', format('AML 表只有 %s/3', v_count));
  END IF;

  -- ============================================================
  -- S9: 稽核記錄表存在
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inference_audit_trail';

  IF v_count > 0 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S9_AUDIT', 'result', 'pass',
      'detail', 'inference_audit_trail 存在');
  ELSE
    v_fail := v_fail + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S9_AUDIT', 'result', 'fail',
      'detail', 'inference_audit_trail 不存在');
  END IF;

  -- ============================================================
  -- S10: 灰度系統就緒
  -- ============================================================
  SELECT count(*) INTO v_count FROM rollout_config;

  IF v_count >= 4 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S10_ROLLOUT', 'result', 'pass',
      'detail', format('%s 個灰度功能已設定', v_count));
  ELSE
    v_warn := v_warn + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S10_ROLLOUT', 'result', 'warning',
      'detail', format('灰度功能只有 %s 個', v_count));
  END IF;

  -- ============================================================
  -- S11: 監控系統就緒
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM pg_tables WHERE schemaname = 'public'
      AND tablename IN ('system_health_checks','system_alerts');

  IF v_count = 2 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S11_MONITORING', 'result', 'pass',
      'detail', '監控表完整');
  ELSE
    v_fail := v_fail + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S11_MONITORING', 'result', 'fail',
      'detail', '監控表不完整');
  END IF;

  -- ============================================================
  -- S12: 風險說明完整性（高風險指令必須有 impact_description_zh）
  -- ============================================================
  SELECT count(*) INTO v_count
    FROM remote_command_templates
    WHERE requires_confirmation = true
      AND (impact_description_zh IS NULL OR impact_description_zh = '');

  IF v_count = 0 THEN
    v_pass := v_pass + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S12_RISK_DESC', 'result', 'pass',
      'detail', '所有高風險指令已有影響說明');
  ELSE
    v_fail := v_fail + 1;
    v_findings := v_findings || jsonb_build_object('check', 'S12_RISK_DESC', 'result', 'fail',
      'detail', format('%s 個高風險指令缺少影響說明', v_count));
  END IF;

  -- ============================================================
  -- 計算總分 + 寫入報告
  -- ============================================================
  v_result := CASE
    WHEN v_fail > 0 THEN 'fail'
    WHEN v_warn > 2 THEN 'warning'
    ELSE 'pass'
  END;

  INSERT INTO compliance_audit_reports (
    audit_type, overall_result, score,
    total_checks, passed_checks, failed_checks, warning_checks,
    findings, audited_by
  ) VALUES (
    'security_scan', v_result,
    CASE WHEN (v_pass + v_fail + v_warn) > 0
      THEN round(v_pass::numeric / (v_pass + v_fail + v_warn) * 100)::int
      ELSE 0 END,
    v_pass + v_fail + v_warn, v_pass, v_fail, v_warn,
    v_findings, 'qrl_scanner'
  )
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object(
    'report_id', v_report_id,
    'result', v_result,
    'score', CASE WHEN (v_pass + v_fail + v_warn) > 0
      THEN round(v_pass::numeric / (v_pass + v_fail + v_warn) * 100)::int ELSE 0 END,
    'passed', v_pass,
    'failed', v_fail,
    'warnings', v_warn,
    'total', v_pass + v_fail + v_warn,
    'go_no_go', CASE WHEN v_fail = 0 THEN 'GO' ELSE 'NO-GO' END,
    'findings', v_findings,
    'message', CASE
      WHEN v_fail = 0 AND v_warn = 0 THEN '全部通過，可以上線'
      WHEN v_fail = 0 THEN format('通過（%s 個警告需注意）', v_warn)
      ELSE format('未通過：%s 個失敗項目必須修復', v_fail)
    END
  );
END;
$$;

-- 3. Go/No-Go 上線閘門
CREATE OR REPLACE FUNCTION pre_launch_gate()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_security jsonb;
  v_health jsonb;
  v_rollout jsonb;
  v_go boolean := true;
  v_blockers jsonb := '[]'::jsonb;
BEGIN
  -- Gate 1: 安全掃描
  v_security := run_security_scan();
  IF v_security->>'go_no_go' = 'NO-GO' THEN
    v_go := false;
    v_blockers := v_blockers || jsonb_build_object('gate', '安全掃描', 'result', 'BLOCKED', 'failed', (v_security->>'failed')::int);
  END IF;

  -- Gate 2: 健康檢查
  v_health := run_health_check();
  IF v_health->>'overall' != 'healthy' THEN
    v_go := false;
    v_blockers := v_blockers || jsonb_build_object('gate', '健康檢查', 'result', 'BLOCKED', 'status', v_health->>'overall');
  END IF;

  -- Gate 3: 灰度狀態
  v_rollout := get_rollout_status();

  -- Gate 4: 未解決警報
  IF (v_health->>'unresolved_alerts')::int > 0 THEN
    v_go := false;
    v_blockers := v_blockers || jsonb_build_object('gate', '未解決警報', 'result', 'BLOCKED', 'count', (v_health->>'unresolved_alerts')::int);
  END IF;

  -- 寫入審計報告
  INSERT INTO compliance_audit_reports (
    audit_type, overall_result, score,
    total_checks, passed_checks, failed_checks, warning_checks,
    findings, audited_by
  ) VALUES (
    'pre_launch',
    CASE WHEN v_go THEN 'pass' ELSE 'fail' END,
    CASE WHEN v_go THEN 100 ELSE 0 END,
    4, CASE WHEN v_go THEN 4 ELSE 4 - jsonb_array_length(v_blockers) END,
    jsonb_array_length(v_blockers), 0,
    jsonb_build_object('security', v_security, 'health', v_health, 'rollout', v_rollout, 'blockers', v_blockers),
    'pre_launch_gate'
  );

  RETURN jsonb_build_object(
    'go_no_go', CASE WHEN v_go THEN 'GO' ELSE 'NO-GO' END,
    'security_score', (v_security->>'score')::int,
    'health', v_health->>'overall',
    'unresolved_alerts', (v_health->>'unresolved_alerts')::int,
    'blockers', v_blockers,
    'rollout', v_rollout,
    'message', CASE
      WHEN v_go THEN '所有閘門通過 — 可以全量上線'
      ELSE format('無法上線：%s 個閘門未通過', jsonb_array_length(v_blockers))
    END
  );
END;
$$;

-- 4. 註冊指令
INSERT INTO remote_command_templates (command, category, description_zh, min_permission, handler, requires_confirmation, cooldown_seconds, usage_example, risk_level, impact_description_zh) VALUES
('/scan',     'compliance', '全方位安全掃描',   'founder', 'compliance-handler', false, 30, '/scan', 'low', '只讀掃描，不影響系統'),
('/gocheck',  'compliance', '上線 Go/No-Go 閘門', 'founder', 'compliance-handler', false, 30, '/gocheck', 'low', '只讀檢查，決定是否可上線')
ON CONFLICT (command) DO NOTHING;

-- ============================================================
-- 驗證
-- ============================================================
DO $$
DECLARE
  v_scan jsonb;
BEGIN
  v_scan := run_security_scan();

  RAISE NOTICE '=== Migration 033 驗證 ===';
  RAISE NOTICE '安全掃描結果: %', v_scan->>'result';
  RAISE NOTICE '分數: %/100', v_scan->>'score';
  RAISE NOTICE '通過: %, 失敗: %, 警告: %', v_scan->>'passed', v_scan->>'failed', v_scan->>'warnings';
  RAISE NOTICE 'Go/No-Go: %', v_scan->>'go_no_go';
  RAISE NOTICE '=== QRL 合規審計系統 READY ===';
END;
$$;
