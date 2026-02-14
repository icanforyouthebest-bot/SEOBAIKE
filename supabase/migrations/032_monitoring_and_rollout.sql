-- ============================================================
-- Migration 032: 監控系統 + 灰度釋放
-- 1. system_health_checks — 健康檢查記錄
-- 2. rollout_config — 灰度釋放控制
-- 3. system_alerts — 警報表
-- 4. RPC 函數
-- ============================================================

-- ============================================================
-- PART A: 監控系統
-- ============================================================

-- 1. 健康檢查記錄表
CREATE TABLE IF NOT EXISTS system_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL,
  component text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy','degraded','down','unknown')),
  response_ms int,
  details jsonb DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shc_type_time ON system_health_checks(check_type, checked_at DESC);
CREATE INDEX idx_shc_status ON system_health_checks(status) WHERE status != 'healthy';

-- 保留 7 天，自動清理
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM system_health_checks WHERE checked_at < now() - interval '7 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 2. 警報表
CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN (
    'high_error_rate','high_latency','service_down',
    'approval_backlog','security_violation','rollout_issue'
  )),
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  component text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sa_unresolved ON system_alerts(is_resolved, created_at DESC) WHERE is_resolved = false;

ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shc_service_all" ON system_health_checks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "sa_service_all" ON system_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. 全系統健康檢查 RPC
CREATE OR REPLACE FUNCTION run_health_check()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_start timestamptz := clock_timestamp();
  v_results jsonb := '[]'::jsonb;
  v_overall text := 'healthy';
  v_count int;
  v_ms int;
  v_pending int;
  v_error_rate numeric;
  v_recent_errors int;
  v_recent_total int;
BEGIN
  -- Check 1: Database connectivity
  v_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int;
  INSERT INTO system_health_checks (check_type, component, status, response_ms)
  VALUES ('db_ping', 'postgresql', 'healthy', v_ms);
  v_results := v_results || jsonb_build_object('check', 'db_ping', 'status', 'healthy', 'ms', v_ms);

  -- Check 2: 表計數
  SELECT count(*) INTO v_count FROM ai_model_registry;
  v_results := v_results || jsonb_build_object('check', 'model_registry', 'status', 'healthy', 'count', v_count);

  INSERT INTO system_health_checks (check_type, component, status, details)
  VALUES ('table_count', 'ai_model_registry', 'healthy', jsonb_build_object('count', v_count));

  -- Check 3: 審批佇列積壓
  SELECT count(*) INTO v_pending
    FROM boss_approval_queue WHERE status IN ('pending','notified') AND expires_at > now();

  IF v_pending > 50 THEN
    v_overall := 'degraded';
    INSERT INTO system_alerts (alert_type, severity, component, message, details)
    VALUES ('approval_backlog', 'warning', 'boss_approval_queue',
      format('審批佇列積壓: %s 筆待處理', v_pending),
      jsonb_build_object('pending_count', v_pending));
  END IF;

  INSERT INTO system_health_checks (check_type, component, status, details)
  VALUES ('approval_queue', 'boss_approval_queue',
    CASE WHEN v_pending > 50 THEN 'degraded' ELSE 'healthy' END,
    jsonb_build_object('pending', v_pending));
  v_results := v_results || jsonb_build_object('check', 'approval_queue', 'pending', v_pending);

  -- Check 4: 最近 1 小時錯誤率
  SELECT count(*) FILTER (WHERE event_type = 'failed'),
         count(*)
  INTO v_recent_errors, v_recent_total
  FROM remote_command_logs
  WHERE created_at > now() - interval '1 hour';

  v_error_rate := CASE WHEN v_recent_total > 0
    THEN round(v_recent_errors::numeric / v_recent_total * 100, 2)
    ELSE 0 END;

  IF v_error_rate > 10 THEN
    v_overall := 'degraded';
    INSERT INTO system_alerts (alert_type, severity, component, message, details)
    VALUES ('high_error_rate', CASE WHEN v_error_rate > 30 THEN 'critical' ELSE 'warning' END,
      'remote_command', format('錯誤率過高: %s%%', v_error_rate),
      jsonb_build_object('error_rate', v_error_rate, 'errors', v_recent_errors, 'total', v_recent_total));
  END IF;

  INSERT INTO system_health_checks (check_type, component, status, details)
  VALUES ('error_rate', 'remote_command',
    CASE WHEN v_error_rate > 10 THEN 'degraded' ELSE 'healthy' END,
    jsonb_build_object('rate', v_error_rate, 'errors', v_recent_errors, 'total', v_recent_total));
  v_results := v_results || jsonb_build_object('check', 'error_rate', 'rate_pct', v_error_rate);

  -- Check 5: 路由表完整性
  SELECT count(*) INTO v_count FROM ai_model_routing_config WHERE is_enabled = true;
  INSERT INTO system_health_checks (check_type, component, status, details)
  VALUES ('routing_config', 'ai_model_routing_config', 'healthy', jsonb_build_object('active_routes', v_count));
  v_results := v_results || jsonb_build_object('check', 'routing_config', 'active_routes', v_count);

  -- Check 6: RLS 啟用狀態
  SELECT count(*) INTO v_count
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('boss_approval_queue','remote_command_bindings','remote_command_templates',
                        'ai_model_registry','system_alerts')
      AND rowsecurity = true;

  INSERT INTO system_health_checks (check_type, component, status, details)
  VALUES ('rls_enabled', 'security',
    CASE WHEN v_count >= 5 THEN 'healthy' ELSE 'degraded' END,
    jsonb_build_object('tables_with_rls', v_count));
  v_results := v_results || jsonb_build_object('check', 'rls_enabled', 'count', v_count);

  v_ms := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int;

  RETURN jsonb_build_object(
    'overall', v_overall,
    'total_ms', v_ms,
    'checked_at', now(),
    'checks', v_results,
    'unresolved_alerts', (SELECT count(*) FROM system_alerts WHERE is_resolved = false)
  );
END;
$$;

-- 4. 查看未解決警報
CREATE OR REPLACE FUNCTION get_active_alerts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'count', count(*),
      'alerts', COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'type', alert_type, 'severity', severity,
        'component', component, 'message', message,
        'created_at', created_at
      ) ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
        created_at DESC
      ), '[]'::jsonb)
    )
    FROM system_alerts WHERE is_resolved = false
  );
END;
$$;

-- 5. 註冊健康檢查指令
INSERT INTO remote_command_templates (command, category, description_zh, min_permission, handler, requires_confirmation, cooldown_seconds, usage_example, risk_level, impact_description_zh) VALUES
('/health',  'system', '全系統健康檢查', 'boss', 'system-handler', false, 10, '/health', 'low', '只讀檢查，不影響系統'),
('/alerts',  'system', '查看未解決警報', 'boss', 'system-handler', false, 5,  '/alerts', 'low', '只讀查詢，不影響系統')
ON CONFLICT (command) DO NOTHING;

-- ============================================================
-- PART B: 灰度釋放系統
-- ============================================================

-- 1. 灰度釋放控制表
CREATE TABLE IF NOT EXISTS rollout_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name text NOT NULL UNIQUE,
  description_zh text NOT NULL,
  rollout_percentage int NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  rollout_stage text NOT NULL DEFAULT 'off' CHECK (rollout_stage IN ('off','canary','partial','full','rollback')),
  target_groups jsonb DEFAULT '[]',
  health_gate jsonb DEFAULT '{"max_error_rate": 5, "min_uptime_pct": 99}',
  auto_advance boolean DEFAULT false,
  current_metrics jsonb DEFAULT '{}',
  last_advanced_at timestamptz,
  created_by text DEFAULT 'founder',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rollout_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rc_service_all" ON rollout_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. 灰度釋放日誌
CREATE TABLE IF NOT EXISTS rollout_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('advance','rollback','pause','resume','gate_check')),
  from_stage text,
  to_stage text,
  from_percentage int,
  to_percentage int,
  gate_result jsonb,
  performed_by text DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rollout_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rl_service_all" ON rollout_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. 預設灰度項目
INSERT INTO rollout_config (feature_name, description_zh, rollout_percentage, rollout_stage) VALUES
('boss_approval',    '老闆手機審批系統',        0, 'off'),
('nvidia_models',    'NVIDIA AI 模型路由',       0, 'off'),
('mcp_tools',        'MCP 工具生態',             0, 'off'),
('multi_platform',   '多平台通知（LINE/WhatsApp/Messenger）', 0, 'off')
ON CONFLICT (feature_name) DO NOTHING;

-- 4. 推進灰度 RPC
CREATE OR REPLACE FUNCTION advance_rollout(
  p_feature text,
  p_performed_by text DEFAULT 'founder'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_config record;
  v_health jsonb;
  v_new_stage text;
  v_new_pct int;
  v_gate_ok boolean := true;
  v_gate_result jsonb;
BEGIN
  SELECT * INTO v_config FROM rollout_config WHERE feature_name = p_feature;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', format('Feature not found: %s', p_feature));
  END IF;

  -- 健康閘門檢查
  v_health := run_health_check();
  v_gate_result := jsonb_build_object(
    'overall', v_health->>'overall',
    'unresolved_alerts', (v_health->>'unresolved_alerts')::int
  );

  IF v_health->>'overall' != 'healthy' THEN
    v_gate_ok := false;
    v_gate_result := v_gate_result || jsonb_build_object('blocked', true, 'reason', '系統不健康，不可推進');
  END IF;

  IF (v_health->>'unresolved_alerts')::int > 0 THEN
    v_gate_ok := false;
    v_gate_result := v_gate_result || jsonb_build_object('blocked', true, 'reason', '有未解決警報');
  END IF;

  -- 決定下一階段
  CASE v_config.rollout_stage
    WHEN 'off' THEN v_new_stage := 'canary'; v_new_pct := 10;
    WHEN 'canary' THEN v_new_stage := 'partial'; v_new_pct := 30;
    WHEN 'partial' THEN v_new_stage := 'full'; v_new_pct := 100;
    WHEN 'full' THEN
      RETURN jsonb_build_object('message', format('%s 已經全量上線', p_feature), 'stage', 'full', 'percentage', 100);
    WHEN 'rollback' THEN v_new_stage := 'canary'; v_new_pct := 10;
    ELSE v_new_stage := 'canary'; v_new_pct := 10;
  END CASE;

  IF NOT v_gate_ok THEN
    INSERT INTO rollout_log (feature_name, action, from_stage, to_stage, from_percentage, to_percentage, gate_result, performed_by)
    VALUES (p_feature, 'gate_check', v_config.rollout_stage, v_new_stage, v_config.rollout_percentage, v_new_pct, v_gate_result, p_performed_by);

    RETURN jsonb_build_object(
      'error', '健康閘門未通過，無法推進',
      'feature', p_feature,
      'current_stage', v_config.rollout_stage,
      'target_stage', v_new_stage,
      'gate_result', v_gate_result
    );
  END IF;

  -- 推進
  UPDATE rollout_config SET
    rollout_stage = v_new_stage,
    rollout_percentage = v_new_pct,
    last_advanced_at = now(),
    current_metrics = v_gate_result,
    updated_at = now()
  WHERE feature_name = p_feature;

  INSERT INTO rollout_log (feature_name, action, from_stage, to_stage, from_percentage, to_percentage, gate_result, performed_by)
  VALUES (p_feature, 'advance', v_config.rollout_stage, v_new_stage, v_config.rollout_percentage, v_new_pct, v_gate_result, p_performed_by);

  RETURN jsonb_build_object(
    'success', true,
    'feature', p_feature,
    'from', format('%s (%s%%)', v_config.rollout_stage, v_config.rollout_percentage),
    'to', format('%s (%s%%)', v_new_stage, v_new_pct),
    'gate_result', v_gate_result,
    'message', format('%s 已推進至 %s (%s%%)', p_feature, v_new_stage, v_new_pct)
  );
END;
$$;

-- 5. 回滾 RPC
CREATE OR REPLACE FUNCTION rollback_rollout(
  p_feature text,
  p_performed_by text DEFAULT 'founder'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_config record;
BEGIN
  SELECT * INTO v_config FROM rollout_config WHERE feature_name = p_feature;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', format('Feature not found: %s', p_feature));
  END IF;

  UPDATE rollout_config SET
    rollout_stage = 'rollback',
    rollout_percentage = 0,
    updated_at = now()
  WHERE feature_name = p_feature;

  INSERT INTO rollout_log (feature_name, action, from_stage, to_stage, from_percentage, to_percentage, performed_by)
  VALUES (p_feature, 'rollback', v_config.rollout_stage, 'rollback', v_config.rollout_percentage, 0, p_performed_by);

  INSERT INTO system_alerts (alert_type, severity, component, message, details)
  VALUES ('rollout_issue', 'warning', p_feature,
    format('%s 已回滾', p_feature),
    jsonb_build_object('from_stage', v_config.rollout_stage, 'from_pct', v_config.rollout_percentage));

  RETURN jsonb_build_object(
    'success', true,
    'feature', p_feature,
    'from', format('%s (%s%%)', v_config.rollout_stage, v_config.rollout_percentage),
    'to', 'rollback (0%)',
    'message', format('%s 已緊急回滾', p_feature)
  );
END;
$$;

-- 6. 查看所有灰度狀態
CREATE OR REPLACE FUNCTION get_rollout_status()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'features', COALESCE(jsonb_agg(jsonb_build_object(
        'feature', feature_name,
        'description', description_zh,
        'stage', rollout_stage,
        'percentage', rollout_percentage,
        'last_advanced', last_advanced_at
      ) ORDER BY feature_name), '[]'::jsonb)
    )
    FROM rollout_config
  );
END;
$$;

-- 7. 註冊灰度指令
INSERT INTO remote_command_templates (command, category, description_zh, min_permission, handler, requires_confirmation, cooldown_seconds, usage_example, risk_level, impact_description_zh) VALUES
('/rollout',   'system', '灰度釋放控制',     'founder', 'system-handler', true, 0, '/rollout advance boss_approval', 'high', '推進灰度會影響用戶可見範圍'),
('/rollback',  'system', '灰度緊急回滾',     'founder', 'system-handler', true, 0, '/rollback boss_approval',        'critical', '立即回滾功能，用戶將失去該功能'),
('/health',    'system', '全系統健康檢查',   'boss',    'system-handler', false, 10, '/health', 'low', '只讀檢查')
ON CONFLICT (command) DO NOTHING;

-- ============================================================
-- 驗證
-- ============================================================
DO $$
DECLARE
  v_health_table boolean;
  v_alerts_table boolean;
  v_rollout_table boolean;
  v_features int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_health_checks') INTO v_health_table;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_alerts') INTO v_alerts_table;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rollout_config') INTO v_rollout_table;
  SELECT count(*) INTO v_features FROM rollout_config;

  RAISE NOTICE '=== Migration 032 驗證 ===';
  RAISE NOTICE 'system_health_checks: %', CASE WHEN v_health_table THEN 'OK' ELSE 'MISSING' END;
  RAISE NOTICE 'system_alerts: %', CASE WHEN v_alerts_table THEN 'OK' ELSE 'MISSING' END;
  RAISE NOTICE 'rollout_config: %', CASE WHEN v_rollout_table THEN 'OK' ELSE 'MISSING' END;
  RAISE NOTICE '灰度功能數: % (預期 4)', v_features;
  RAISE NOTICE '=== 監控 + 灰度系統 READY ===';
END;
$$;
