-- ============================================================
-- Migration 042: 安全性強化 — RLS 覆蓋 + execute_remote_command 修復
-- 修復掃描發現的所有安全缺口
-- ============================================================

-- ============================================================
-- 1. 修復 execute_remote_command — user_id 改為可選
--    Edge Function 只傳 (command_type, request_metadata)
--    SQL function 從 metadata 中解析 platform binding
-- ============================================================
CREATE OR REPLACE FUNCTION execute_remote_command(
  command_type text,
  user_id uuid DEFAULT NULL,
  request_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_permission text;
  v_template record;
  v_result jsonb;
  v_command_id uuid;
  v_sub_command text;
  v_args jsonb;
  v_start_ts timestamptz := clock_timestamp();
  v_resolved_user_id uuid;
BEGIN
  -- ============================
  -- 0. 解析 user_id（若未直接提供，從 metadata 的 platform binding 解析）
  -- ============================
  v_resolved_user_id := user_id;
  IF v_resolved_user_id IS NULL AND request_metadata->>'source_user_id' IS NOT NULL THEN
    SELECT rcb.user_id INTO v_resolved_user_id
      FROM remote_command_bindings rcb
      WHERE rcb.platform_user_id = request_metadata->>'source_user_id'
        AND rcb.platform = COALESCE(request_metadata->>'source', 'web')
        AND rcb.is_verified = true
      LIMIT 1;
  END IF;

  -- ============================
  -- 0b. 解析指令與子指令
  -- ============================
  v_sub_command := request_metadata->>'sub_command';
  v_args := COALESCE(request_metadata->'args', '{}'::jsonb);

  -- ============================
  -- 1. 查詢用戶權限
  -- ============================
  IF v_resolved_user_id IS NOT NULL THEN
    SELECT permission_level INTO v_permission
      FROM remote_command_bindings
      WHERE remote_command_bindings.user_id = v_resolved_user_id
        AND is_verified = true
      LIMIT 1;

    IF v_permission IS NULL THEN
      SELECT role_name INTO v_permission
        FROM os_roles
        WHERE os_roles.user_id = v_resolved_user_id
        LIMIT 1;

      IF v_permission = 'boss' OR v_permission = 'founder' THEN
        v_permission := v_permission;
      ELSE
        v_permission := 'user';
      END IF;
    END IF;
  ELSE
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
      'user_id', v_resolved_user_id,
      'user_level', v_permission,
      'required_level', v_template.min_permission
    ));

    RAISE EXCEPTION 'Permission denied. Required: %, yours: %',
      v_template.min_permission, v_permission;
  END IF;

  -- ============================
  -- 4. 寫入指令記錄
  -- ============================
  INSERT INTO remote_commands (
    user_id, session_id, command_type, command_data, status,
    parsed_command, parsed_args, permission_level, source
  ) VALUES (
    v_resolved_user_id,
    COALESCE(request_metadata->>'session_id', gen_random_uuid()::text),
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
  -- 5. 分派執行
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
      v_result := handle_payment_command(command_type, v_sub_command, v_args, v_resolved_user_id, v_permission);
    WHEN 'seo-handler' THEN
      v_result := handle_seo_command(v_sub_command, v_args);
    WHEN 'compliance-handler' THEN
      v_result := handle_compliance_command(command_type, v_sub_command, v_args);
    WHEN 'l1l4-handler' THEN
      v_result := handle_l1l4_command(command_type, v_sub_command, v_args);
    WHEN 'account-handler' THEN
      v_result := handle_account_command(command_type, v_sub_command, v_args, v_resolved_user_id, v_permission);
    ELSE
      RAISE EXCEPTION 'No handler for: %', v_template.handler;
  END CASE;

  -- ============================
  -- 6. 更新結果
  -- ============================
  UPDATE remote_commands SET
    status = 'completed',
    result = v_result,
    reply_text = v_result->>'message',
    executed_at = now(),
    duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_ts)::int
  WHERE id = v_command_id;

  INSERT INTO remote_command_logs (command_id, event_type, details)
  VALUES (v_command_id, 'completed', jsonb_build_object(
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_ts)::int
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
    VALUES (v_command_id, 'failed', jsonb_build_object('error', SQLERRM));
  END IF;

  RAISE;
END;
$$;

-- ============================================================
-- 2. 啟用 RLS — 所有含機敏資料的表
-- ============================================================

-- "secure" 後綴表（竟然沒有 RLS 是最大的諷刺）
DO $$ BEGIN
  ALTER TABLE IF EXISTS ai_customer_logs_secure ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS admin_2fa_settings_secure ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS admin_sessions_secure ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS payment_settings_secure ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS customer_feedback_secure ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS merchant_orders_secure ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 其他高風險表
DO $$ BEGIN
  ALTER TABLE IF EXISTS secret_api_keys ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS external_api_keys ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS admin_sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS login_attempts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS security_audit_log ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS voice_auth_logs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS ai_execution_audit_log ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS ai_execution_audit_log_old ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS ai_execution_audit_log_2026_02 ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 3. RLS 政策 — 只允許 service_role 存取（最安全模式）
-- ============================================================

-- helper: 為每張 secure 表建立 service_role only 政策
DO $$
DECLARE
  tbl text;
  policy_name text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'ai_customer_logs_secure',
      'admin_2fa_settings_secure',
      'admin_sessions_secure',
      'payment_settings_secure',
      'customer_feedback_secure',
      'merchant_orders_secure',
      'secret_api_keys',
      'external_api_keys',
      'admin_sessions',
      'login_attempts',
      'security_audit_log',
      'voice_auth_logs',
      'ai_execution_audit_log',
      'ai_execution_audit_log_old',
      'ai_execution_audit_log_2026_02'
    ])
  LOOP
    policy_name := 'service_role_only_' || tbl;
    -- 先刪除已存在的同名政策（冪等）
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, tbl);
    -- 建立 service_role 全存取政策
    BEGIN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        policy_name, tbl
      );
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'Table % does not exist, skipping', tbl;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 4. 為缺少時間戳的審計表補上 created_at
-- ============================================================
DO $$ BEGIN
  ALTER TABLE IF EXISTS audit_log ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  ALTER TABLE IF EXISTS legal_audit_trail ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 5. 為 stress_test_results 加索引（0 索引 5000 行）
-- ============================================================
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_stress_test_results_created
    ON stress_test_results (created_at DESC);
EXCEPTION WHEN undefined_table THEN NULL;
         WHEN undefined_column THEN NULL;
END $$;
