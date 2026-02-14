-- ============================================================
-- Migration 025: execute_remote_command() 參數對齊 Edge Function
-- Edge Function 傳 2 參數：command_type + request_metadata
-- user_id 從 request_metadata 內讀取
-- Migration: 20260213_align_rpc_signature
-- ============================================================

-- 先 DROP 舊的 3 參數版本
DROP FUNCTION IF EXISTS execute_remote_command(text, uuid, jsonb);

CREATE OR REPLACE FUNCTION execute_remote_command(
  command_type text,
  request_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_permission text;
  v_template record;
  v_result jsonb;
  v_command_id uuid;
  v_sub_command text;
  v_args jsonb;
  v_start_ts timestamptz := clock_timestamp();
  v_session_id text;
  v_compliance jsonb;
  v_check_id uuid;
BEGIN
  -- ============================
  -- 0. 從 request_metadata 解析參數
  -- ============================
  v_user_id := NULLIF(request_metadata->>'user_id', '')::uuid;
  v_sub_command := request_metadata->>'sub_command';
  v_args := COALESCE(request_metadata->'args', '{}'::jsonb);
  v_session_id := COALESCE(request_metadata->>'session_id', gen_random_uuid()::text);

  -- ============================
  -- 1. 查詢用戶權限
  -- ============================
  IF v_user_id IS NOT NULL THEN
    SELECT permission_level INTO v_permission
      FROM remote_command_bindings
      WHERE remote_command_bindings.user_id = v_user_id
        AND is_verified = true
      LIMIT 1;
  END IF;

  IF v_permission IS NULL AND v_user_id IS NOT NULL THEN
    SELECT role_name INTO v_permission
      FROM os_roles
      WHERE os_roles.user_id = v_user_id
      LIMIT 1;

    IF v_permission = 'boss' OR v_permission = 'founder' THEN
      v_permission := v_permission;
    ELSE
      v_permission := 'user';
    END IF;
  END IF;

  IF v_permission IS NULL THEN
    v_permission := 'user';
  END IF;

  -- ============================
  -- 2. 查詢指令模板
  -- ============================
  SELECT * INTO v_template
    FROM remote_command_templates
    WHERE command = command_type
      AND is_enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown command: %', command_type;
  END IF;

  -- ============================
  -- 3. 權限檢查
  -- ============================
  IF NOT check_permission_level(v_permission, v_template.min_permission) THEN
    INSERT INTO remote_command_logs (event_type, details)
    VALUES ('permission_denied', jsonb_build_object(
      'command', command_type,
      'user_id', v_user_id,
      'user_level', v_permission,
      'required_level', v_template.min_permission
    ));
    RAISE EXCEPTION 'Permission denied. Required: %, yours: %',
      v_template.min_permission, v_permission;
  END IF;

  -- ============================================================
  -- 4. 合規閘門第一層：check_inference_path() — 專利 115100981
  -- ============================================================
  v_compliance := check_inference_path(
    v_session_id,
    NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'command', command_type,
      'user_id', COALESCE(v_user_id::text, 'anonymous'),
      'source', COALESCE(request_metadata->>'source', 'unknown'),
      'permission', v_permission,
      'category', v_template.category
    )
  );

  IF (v_compliance->>'verdict') != 'allowed' THEN
    INSERT INTO remote_command_logs (event_type, details)
    VALUES ('compliance_blocked', jsonb_build_object(
      'command', command_type,
      'user_id', v_user_id,
      'verdict', v_compliance->>'verdict',
      'reason', v_compliance->>'reason'
    ));
    RAISE EXCEPTION 'Compliance: % — %',
      v_compliance->>'verdict', v_compliance->>'reason';
  END IF;

  v_check_id := (v_compliance->>'check_id')::uuid;

  -- ============================================================
  -- 5. 合規閘門第二層：AML 洗錢防制
  -- ============================================================
  IF v_template.category = 'payment' AND v_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM aml_alerts
      WHERE aml_alerts.user_id = v_user_id
        AND status IN ('pending', 'investigating')
    ) THEN
      INSERT INTO remote_command_logs (event_type, details)
      VALUES ('aml_blocked', jsonb_build_object(
        'command', command_type,
        'user_id', v_user_id,
        'reason', 'Active AML alert on account'
      ));
      RAISE EXCEPTION 'AML: Account has active alert. Financial operation blocked.';
    END IF;
  END IF;

  -- ============================================================
  -- 6. 合規閘門第三層：PDPA 個資保護記錄
  -- ============================================================
  IF v_template.category IN ('user', 'account', 'payment') THEN
    INSERT INTO remote_command_logs (event_type, details)
    VALUES ('pdpa_access_log', jsonb_build_object(
      'command', command_type,
      'accessor_id', v_user_id,
      'accessor_permission', v_permission,
      'access_purpose', v_template.description_zh,
      'data_category', v_template.category,
      'session_id', v_session_id
    ));
  END IF;

  -- ============================
  -- 7. 寫入指令記錄
  -- ============================
  INSERT INTO remote_commands (
    user_id, session_id, command_type, command_data, status,
    parsed_command, parsed_args, permission_level, source
  ) VALUES (
    v_user_id,
    v_session_id,
    command_type,
    request_metadata,
    'executing',
    command_type,
    v_args,
    v_permission,
    COALESCE(request_metadata->>'source', 'web')
  )
  RETURNING id INTO v_command_id;

  -- ============================
  -- 8. 分派執行
  -- ============================
  CASE v_template.handler
    WHEN 'system-handler' THEN
      v_result := handle_system_command(command_type, v_sub_command, v_args, v_permission);
    WHEN 'feature-handler' THEN
      v_result := handle_feature_command(v_sub_command, v_args, v_permission);
    WHEN 'ai-handler' THEN
      v_result := handle_ai_command(v_sub_command, v_args, v_permission);
    WHEN 'user-handler' THEN
      v_result := handle_user_command(command_type, v_sub_command, v_args, v_permission);
    WHEN 'payment-handler' THEN
      v_result := handle_payment_command(command_type, v_sub_command, v_args, v_user_id, v_permission);
    WHEN 'seo-handler' THEN
      v_result := handle_seo_command(v_sub_command, v_args);
    WHEN 'compliance-handler' THEN
      v_result := handle_compliance_command(command_type, v_sub_command, v_args);
    WHEN 'l1l4-handler' THEN
      v_result := handle_l1l4_command(command_type, v_sub_command, v_args);
    WHEN 'account-handler' THEN
      v_result := handle_account_command(command_type, v_sub_command, v_args, v_user_id, v_permission);
    ELSE
      RAISE EXCEPTION 'No handler for: %', v_template.handler;
  END CASE;

  -- ============================
  -- 9. 更新結果
  -- ============================
  UPDATE remote_commands SET
    status = 'completed',
    result = v_result,
    reply_text = v_result->>'message',
    executed_at = now(),
    duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_ts)::int
  WHERE id = v_command_id;

  -- ============================================================
  -- 10. 合規閘門第四層：稽核記錄
  -- ============================================================
  INSERT INTO inference_audit_trail (
    session_id, model_type, model_identifier, task_type,
    input_summary, output_summary,
    path_check_id, inference_status,
    started_at, completed_at
  ) VALUES (
    v_session_id,
    'rule_engine',
    'execute_remote_command/' || command_type,
    'other',
    jsonb_build_object(
      'command', command_type,
      'sub_command', v_sub_command,
      'args', v_args,
      'source', COALESCE(request_metadata->>'source', 'web'),
      'user_id', v_user_id
    )::text,
    COALESCE(v_result->>'message', 'no message'),
    v_check_id,
    'success',
    v_start_ts,
    clock_timestamp()
  );

  INSERT INTO remote_command_logs (command_id, event_type, details)
  VALUES (v_command_id, 'completed', jsonb_build_object(
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_ts)::int,
    'compliance_check_id', v_check_id,
    'session_id', v_session_id
  ));

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  IF v_command_id IS NOT NULL THEN
    UPDATE remote_commands SET
      status = 'failed',
      error_message = SQLERRM,
      duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_ts)::int
    WHERE id = v_command_id;

    INSERT INTO remote_command_logs (command_id, event_type, details)
    VALUES (v_command_id, 'failed', jsonb_build_object(
      'error', SQLERRM,
      'session_id', v_session_id
    ));

    INSERT INTO inference_audit_trail (
      session_id, model_type, model_identifier, task_type,
      input_summary, output_summary,
      path_check_id, inference_status,
      started_at, completed_at
    ) VALUES (
      v_session_id,
      'rule_engine',
      'execute_remote_command/' || command_type,
      'other',
      command_type,
      SQLERRM,
      v_check_id,
      'failed',
      v_start_ts,
      clock_timestamp()
    );
  END IF;

  RAISE;
END;
$$;

COMMENT ON FUNCTION execute_remote_command(text, jsonb) IS 'Universal Remote Control dispatcher — 2 params (command_type + request_metadata). 4-layer compliance gate: Patent 115100981 + AML + PDPA + Audit Trail';
