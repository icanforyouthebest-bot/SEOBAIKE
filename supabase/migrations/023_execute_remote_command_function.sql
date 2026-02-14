-- ============================================================
-- Migration 023: execute_remote_command() — 遙控器指揮官函數
-- 所有遠端指令的唯一入口，Edge Function 只做轉發
-- ============================================================

CREATE OR REPLACE FUNCTION execute_remote_command(
  command_type text,
  user_id uuid,
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
BEGIN
  -- ============================
  -- 0. 解析指令與子指令
  -- ============================
  -- "/feature list" → command="/feature", sub_command="list"
  -- "/lock"         → command="/lock",    sub_command=null
  v_sub_command := request_metadata->>'sub_command';
  v_args := COALESCE(request_metadata->'args', '{}'::jsonb);

  -- ============================
  -- 1. 查詢用戶權限
  -- ============================
  SELECT permission_level INTO v_permission
    FROM remote_command_bindings
    WHERE remote_command_bindings.user_id = execute_remote_command.user_id
      AND is_verified = true
    LIMIT 1;

  -- 未綁定或未驗證
  IF v_permission IS NULL THEN
    -- 檢查是否為 os_roles 中的 boss
    SELECT role_name INTO v_permission
      FROM os_roles
      WHERE os_roles.user_id = execute_remote_command.user_id
      LIMIT 1;

    IF v_permission = 'boss' OR v_permission = 'founder' THEN
      v_permission := v_permission;
    ELSE
      v_permission := 'user';
    END IF;
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
    -- 記錄拒絕
    INSERT INTO remote_command_logs (event_type, details)
    VALUES ('permission_denied', jsonb_build_object(
      'command', command_type,
      'user_id', user_id,
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
    user_id,
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

    -- ── 系統控制 ──
    WHEN 'system-handler' THEN
      v_result := handle_system_command(command_type, v_sub_command, v_args, v_permission);

    -- ── 功能開關 ──
    WHEN 'feature-handler' THEN
      v_result := handle_feature_command(v_sub_command, v_args, v_permission);

    -- ── AI 路由 ──
    WHEN 'ai-handler' THEN
      v_result := handle_ai_command(v_sub_command, v_args, v_permission);

    -- ── 用戶管理 ──
    WHEN 'user-handler' THEN
      v_result := handle_user_command(command_type, v_sub_command, v_args, v_permission);

    -- ── 金流 ──
    WHEN 'payment-handler' THEN
      v_result := handle_payment_command(command_type, v_sub_command, v_args, user_id, v_permission);

    -- ── SEO ──
    WHEN 'seo-handler' THEN
      v_result := handle_seo_command(v_sub_command, v_args);

    -- ── 合規 ──
    WHEN 'compliance-handler' THEN
      v_result := handle_compliance_command(command_type, v_sub_command, v_args);

    -- ── L1-L4 約束層 ──
    WHEN 'l1l4-handler' THEN
      v_result := handle_l1l4_command(command_type, v_sub_command, v_args);

    -- ── 帳戶 ──
    WHEN 'account-handler' THEN
      v_result := handle_account_command(command_type, v_sub_command, v_args, user_id, v_permission);

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
  -- 記錄失敗
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
-- 權限等級比較函數
-- ============================================================
CREATE OR REPLACE FUNCTION check_permission_level(
  user_level text,
  required_level text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
DECLARE
  v_ranks jsonb := '{"founder":3,"boss":2,"user":1}'::jsonb;
BEGIN
  RETURN COALESCE((v_ranks->>user_level)::int, 0)
      >= COALESCE((v_ranks->>required_level)::int, 0);
END;
$$;

-- ============================================================
-- Handler 函數們
-- ============================================================

-- ── system-handler ──
CREATE OR REPLACE FUNCTION handle_system_command(
  p_command text, p_sub text, p_args jsonb, p_perm text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  CASE p_command
    WHEN '/status' THEN
      SELECT jsonb_build_object(
        'message', 'System Status',
        'system_lock', (SELECT jsonb_build_object('is_locked', is_locked, 'locked_by', locked_by, 'description', description) FROM system_lock LIMIT 1),
        'maintenance_mode', (SELECT value FROM system_settings WHERE key = 'maintenance_mode'),
        'health', (SELECT jsonb_agg(jsonb_build_object('component', component, 'status', status, 'last_heartbeat', last_heartbeat)) FROM system_health),
        'tables_count', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
        'feature_flags_on', (SELECT count(*) FROM feature_flags WHERE enabled = true)
      ) INTO v_result;

    WHEN '/lock' THEN
      UPDATE system_lock SET is_locked = true, locked_at = now(), locked_by = p_perm, description = 'Remote lock via remote-command' WHERE id = 1;
      v_result := jsonb_build_object('message', 'System LOCKED (read-only mode)', 'status', 'locked');

    WHEN '/unlock' THEN
      UPDATE system_lock SET is_locked = false, locked_at = now(), locked_by = p_perm, description = 'Unlocked via remote-command' WHERE id = 1;
      v_result := jsonb_build_object('message', 'System UNLOCKED', 'status', 'unlocked');

    WHEN '/maintenance' THEN
      UPDATE system_settings SET value = to_jsonb(NOT (value)::boolean) WHERE key = 'maintenance_mode';
      SELECT jsonb_build_object('message', 'Maintenance mode toggled', 'current', value) INTO v_result FROM system_settings WHERE key = 'maintenance_mode';

    ELSE
      v_result := jsonb_build_object('error', 'Unknown system command');
  END CASE;

  RETURN v_result;
END;
$$;

-- ── feature-handler ──
CREATE OR REPLACE FUNCTION handle_feature_command(
  p_sub text, p_args jsonb, p_perm text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
  v_key text;
  v_action text;
BEGIN
  v_key := p_args->>'key';
  v_action := COALESCE(p_sub, 'list');

  CASE v_action
    WHEN 'list' THEN
      SELECT jsonb_build_object(
        'message', 'Feature Flags',
        'flags', jsonb_agg(jsonb_build_object('key', key, 'enabled', enabled, 'description', description) ORDER BY key)
      ) INTO v_result FROM feature_flags;

    WHEN 'on' THEN
      UPDATE feature_flags SET enabled = true WHERE key = v_key;
      v_result := jsonb_build_object('message', format('Feature [%s] ON', v_key), 'key', v_key, 'enabled', true);

    WHEN 'off' THEN
      UPDATE feature_flags SET enabled = false WHERE key = v_key;
      v_result := jsonb_build_object('message', format('Feature [%s] OFF', v_key), 'key', v_key, 'enabled', false);

    ELSE
      v_result := jsonb_build_object('message', 'Usage: /feature list | /feature on [key] | /feature off [key]');
  END CASE;

  RETURN v_result;
END;
$$;

-- ── ai-handler ──
CREATE OR REPLACE FUNCTION handle_ai_command(
  p_sub text, p_args jsonb, p_perm text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  CASE COALESCE(p_sub, 'list')
    WHEN 'list' THEN
      SELECT jsonb_build_object(
        'message', 'AI Model Routing',
        'routes', jsonb_agg(jsonb_build_object(
          'route', route_name, 'provider', provider, 'model', model, 'enabled', is_enabled
        ) ORDER BY priority)
      ) INTO v_result FROM ai_model_routing_config;

    WHEN 'switch' THEN
      UPDATE ai_model_routing_config
        SET provider = COALESCE(p_args->>'provider', provider),
            model = COALESCE(p_args->>'model', model),
            updated_at = now()
        WHERE route_name = p_args->>'route';
      v_result := jsonb_build_object('message', format('Route [%s] updated', p_args->>'route'));

    WHEN 'cost' THEN
      SELECT jsonb_build_object(
        'message', 'AI Cost Stats',
        'stats', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (
          SELECT route_name, count(*) as calls FROM ai_cost_stats GROUP BY route_name ORDER BY calls DESC LIMIT 10
        ) t), '[]'::jsonb)
      ) INTO v_result;

    ELSE
      v_result := jsonb_build_object('message', 'Usage: /ai list | /ai switch [route] | /ai cost');
  END CASE;

  RETURN v_result;
END;
$$;

-- ── user-handler ──
CREATE OR REPLACE FUNCTION handle_user_command(
  p_command text, p_sub text, p_args jsonb, p_perm text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  CASE p_command
    WHEN '/users' THEN
      CASE COALESCE(p_sub, 'count')
        WHEN 'count' THEN
          SELECT jsonb_build_object(
            'message', 'User Stats',
            'total', (SELECT count(*) FROM auth.users),
            'bindings', (SELECT count(*) FROM remote_command_bindings WHERE is_verified = true)
          ) INTO v_result;

        WHEN 'ban' THEN
          -- Mark user as banned in profiles
          UPDATE profiles SET status = 'banned' WHERE id = (p_args->>'target_id')::uuid;
          v_result := jsonb_build_object('message', format('User %s banned', p_args->>'target_id'));

        ELSE
          v_result := jsonb_build_object('message', 'Usage: /users count | /users ban [user_id]');
      END CASE;

    WHEN '/kyc' THEN
      SELECT jsonb_build_object(
        'message', 'KYC Status',
        'records', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'user_id', user_id, 'level', level, 'status', status, 'created_at', created_at
        )) FROM kyc_verification
        WHERE (p_args->>'target_id' IS NULL OR user_id = (p_args->>'target_id')::uuid)
        LIMIT 20), '[]'::jsonb)
      ) INTO v_result;

    ELSE
      v_result := jsonb_build_object('error', 'Unknown user command');
  END CASE;

  RETURN v_result;
END;
$$;

-- ── payment-handler ──
CREATE OR REPLACE FUNCTION handle_payment_command(
  p_command text, p_sub text, p_args jsonb, p_user_id uuid, p_perm text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
  v_period text;
  v_start timestamptz;
BEGIN
  CASE p_command
    WHEN '/revenue' THEN
      v_period := COALESCE(p_sub, 'today');
      v_start := CASE v_period
        WHEN 'today' THEN date_trunc('day', now())
        WHEN 'week' THEN date_trunc('week', now())
        WHEN 'month' THEN date_trunc('month', now())
        WHEN 'year' THEN date_trunc('year', now())
        ELSE date_trunc('day', now())
      END;

      SELECT jsonb_build_object(
        'message', format('Revenue (%s)', v_period),
        'total_cents', COALESCE(SUM(amount_cents), 0),
        'count', count(*),
        'period_start', v_start
      ) INTO v_result
      FROM payments
      WHERE status = 'captured' AND paid_at >= v_start;

    WHEN '/refund' THEN
      v_result := jsonb_build_object(
        'message', 'Refund requires confirmation via Cloudflare Worker',
        'order_id', p_args->>'order_id'
      );

    WHEN '/points' THEN
      CASE COALESCE(p_sub, 'balance')
        WHEN 'balance' THEN
          SELECT jsonb_build_object(
            'message', 'Points Balance',
            'balance', COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0)
          ) INTO v_result
          FROM point_transactions
          WHERE user_id = p_user_id;

        WHEN 'grant' THEN
          INSERT INTO point_transactions (user_id, type, amount, description)
          VALUES (
            (p_args->>'target_id')::uuid,
            'credit',
            (p_args->>'amount')::int,
            format('Granted by %s via remote-command', p_perm)
          );
          v_result := jsonb_build_object('message', format('Granted %s points to %s', p_args->>'amount', p_args->>'target_id'));

        ELSE
          v_result := jsonb_build_object('message', 'Usage: /points | /points grant [user_id] [amount]');
      END CASE;

    ELSE
      v_result := jsonb_build_object('error', 'Unknown payment command');
  END CASE;

  RETURN v_result;
END;
$$;

-- ── seo-handler ──
CREATE OR REPLACE FUNCTION handle_seo_command(
  p_sub text, p_args jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  CASE COALESCE(p_sub, 'list')
    WHEN 'list' THEN
      SELECT jsonb_build_object(
        'message', 'SEO Bases',
        'bases', COALESCE(jsonb_agg(jsonb_build_object('domain', domain, 'owner', owner_email)), '[]'::jsonb)
      ) INTO v_result FROM seo_bases;

    WHEN 'scan' THEN
      v_result := jsonb_build_object(
        'message', format('SEO scan queued for %s', p_args->>'domain'),
        'status', 'queued'
      );

    WHEN 'report' THEN
      SELECT jsonb_build_object(
        'message', format('SEO Reports for %s', p_args->>'domain'),
        'reports', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (
          SELECT * FROM seo_reports WHERE domain = p_args->>'domain' ORDER BY created_at DESC LIMIT 5
        ) t), '[]'::jsonb)
      ) INTO v_result;

    ELSE
      v_result := jsonb_build_object('message', 'Usage: /seo list | /seo scan [domain] | /seo report [domain]');
  END CASE;

  RETURN v_result;
END;
$$;

-- ── compliance-handler ──
CREATE OR REPLACE FUNCTION handle_compliance_command(
  p_command text, p_sub text, p_args jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  CASE p_command
    WHEN '/aml' THEN
      SELECT jsonb_build_object(
        'message', 'AML Alerts',
        'pending', (SELECT count(*) FROM aml_alerts WHERE status = 'pending'),
        'recent', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', id, 'rule_id', rule_id, 'status', status, 'triggered_at', triggered_at
        )) FROM (SELECT * FROM aml_alerts ORDER BY triggered_at DESC LIMIT 10) t), '[]'::jsonb)
      ) INTO v_result;

    WHEN '/compliance' THEN
      SELECT jsonb_build_object(
        'message', 'Compliance Check',
        'checks', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', id, 'check_type', check_type, 'status', status, 'created_at', created_at
        )) FROM (SELECT * FROM compliance_checks ORDER BY created_at DESC LIMIT 10) t), '[]'::jsonb)
      ) INTO v_result;

    ELSE
      v_result := jsonb_build_object('error', 'Unknown compliance command');
  END CASE;

  RETURN v_result;
END;
$$;

-- ── l1l4-handler ──
CREATE OR REPLACE FUNCTION handle_l1l4_command(
  p_command text, p_sub text, p_args jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  CASE p_command
    WHEN '/l1' THEN
      SELECT jsonb_build_object(
        'message', 'L1 Categories',
        'data', jsonb_agg(jsonb_build_object('code', code, 'name', name_zh, 'en', name_en) ORDER BY code)
      ) INTO v_result FROM l1_categories;

    WHEN '/l2' THEN
      SELECT jsonb_build_object(
        'message', format('L2 Subcategories (L1: %s)', COALESCE(p_args->>'l1_code', 'all')),
        'data', jsonb_agg(jsonb_build_object('code', l2.code, 'name', l2.name_zh, 'l1', l1.code) ORDER BY l2.code)
      ) INTO v_result
      FROM l2_subcategories l2 JOIN l1_categories l1 ON l2.l1_id = l1.id
      WHERE p_args->>'l1_code' IS NULL OR l1.code = p_args->>'l1_code';

    WHEN '/l3' THEN
      SELECT jsonb_build_object(
        'message', format('L3 Processes (L2: %s)', COALESCE(p_args->>'l2_code', 'all')),
        'data', jsonb_agg(jsonb_build_object('code', l3.code, 'name', l3.name_zh, 'l2', l2.code) ORDER BY l3.code)
      ) INTO v_result
      FROM l3_processes l3 JOIN l2_subcategories l2 ON l3.l2_id = l2.id
      WHERE p_args->>'l2_code' IS NULL OR l2.code = p_args->>'l2_code';

    WHEN '/l4' THEN
      SELECT jsonb_build_object(
        'message', format('L4 Nodes (L3: %s)', COALESCE(p_args->>'l3_code', 'all')),
        'data', jsonb_agg(jsonb_build_object('code', l4.code, 'name', l4.name_zh, 'l3', l3.code) ORDER BY l4.code)
      ) INTO v_result
      FROM l4_nodes l4 JOIN l3_processes l3 ON l4.l3_id = l3.id
      WHERE p_args->>'l3_code' IS NULL OR l3.code = p_args->>'l3_code';

    WHEN '/path' THEN
      v_result := jsonb_build_object(
        'message', 'Path Check',
        'result', (SELECT check_inference_path(
          COALESCE(p_args->>'session_id', gen_random_uuid()::text),
          (p_args->>'l1_id')::uuid,
          (p_args->>'l2_id')::uuid,
          (p_args->>'l3_id')::uuid,
          (p_args->>'l4_id')::uuid,
          '{}'::jsonb
        ))
      );

    ELSE
      v_result := jsonb_build_object('error', 'Unknown l1l4 command');
  END CASE;

  RETURN v_result;
END;
$$;

-- ── account-handler ──
CREATE OR REPLACE FUNCTION handle_account_command(
  p_command text, p_sub text, p_args jsonb, p_user_id uuid, p_perm text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  CASE p_command
    WHEN '/me' THEN
      SELECT jsonb_build_object(
        'message', 'Your Profile',
        'user_id', p_user_id,
        'permission', p_perm,
        'bindings', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'platform', platform, 'verified', is_verified, 'bound_at', bound_at
        )) FROM remote_command_bindings WHERE user_id = p_user_id), '[]'::jsonb)
      ) INTO v_result;

    WHEN '/bind' THEN
      v_result := jsonb_build_object(
        'message', 'Binding is handled by Cloudflare Worker. Send /bind from your messaging app.',
        'status', 'redirect'
      );

    WHEN '/help' THEN
      SELECT jsonb_build_object(
        'message', 'Available Commands',
        'commands', jsonb_agg(jsonb_build_object(
          'command', command,
          'description', description_zh,
          'permission', min_permission
        ) ORDER BY category, command)
      ) INTO v_result
      FROM remote_command_templates
      WHERE is_enabled = true
        AND check_permission_level(p_perm, min_permission);

    ELSE
      v_result := jsonb_build_object('error', 'Unknown account command');
  END CASE;

  RETURN v_result;
END;
$$;
