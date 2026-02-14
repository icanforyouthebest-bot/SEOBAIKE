-- ============================================================
-- Migration 030: 老闆手機審批系統
-- 雲端 + 中機端 + APP 全部合體
-- 核心原則：先解釋給老闆判斷，不然老闆怎麼按
-- ============================================================

-- ============================================================
-- STEP 1: 新表 boss_approval_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS boss_approval_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 原始指令
  command text NOT NULL,
  sub_command text,
  args jsonb DEFAULT '{}',
  request_metadata jsonb DEFAULT '{}',

  -- 請求者
  requester_binding_id uuid,
  requester_user_id uuid,
  requester_platform text CHECK (requester_platform IN ('line','telegram','whatsapp','messenger','web')),
  requester_platform_user_id text,
  requester_display_name text,

  -- 審批者（老闆）
  approver_binding_id uuid,
  approver_user_id uuid,
  approver_platform text CHECK (approver_platform IN ('line','telegram','whatsapp','messenger','web')),

  -- 狀態
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','notified','approved','rejected','executed','failed','expired','cancelled'
  )),

  -- 審批碼（6位，跨平台文字確認用）
  approval_code text NOT NULL DEFAULT upper(substring(gen_random_uuid()::text from 1 for 6)),

  -- 指令解釋（給老闆看的）
  command_description_zh text,
  risk_level text,
  impact_description_zh text,

  -- 通知追蹤
  notification_sent_at timestamptz,
  notification_message_id text,

  -- 結果
  decision_at timestamptz,
  decision_reason text,
  execution_result jsonb,

  -- 時間
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE boss_approval_queue IS '老闆手機審批佇列 — 先解釋再讓老闆判斷';

-- 索引
CREATE INDEX idx_baq_status ON boss_approval_queue(status) WHERE status IN ('pending','notified');
CREATE INDEX idx_baq_approver ON boss_approval_queue(approver_user_id, status);
CREATE INDEX idx_baq_code ON boss_approval_queue(approval_code) WHERE status IN ('pending','notified');
CREATE INDEX idx_baq_expires ON boss_approval_queue(expires_at) WHERE status IN ('pending','notified');

-- Realtime
ALTER TABLE boss_approval_queue REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE boss_approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baq_service_all" ON boss_approval_queue
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_baq_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_baq_updated_at
  BEFORE UPDATE ON boss_approval_queue
  FOR EACH ROW EXECUTE FUNCTION update_baq_updated_at();

-- ============================================================
-- STEP 2: 擴充 remote_command_templates — 風險等級 + 影響說明
-- ============================================================
ALTER TABLE remote_command_templates
  ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS impact_description_zh text;

-- 加 CHECK（先 DROP 避免重複）
DO $$
BEGIN
  ALTER TABLE remote_command_templates
    ADD CONSTRAINT rct_risk_level_check
    CHECK (risk_level IN ('low','medium','high','critical'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

-- 更新高風險指令的說明
UPDATE remote_command_templates SET
  risk_level = 'critical',
  impact_description_zh = '鎖定全系統，所有用戶將無法操作，僅 founder 可解鎖'
WHERE command = '/lock';

UPDATE remote_command_templates SET
  risk_level = 'critical',
  impact_description_zh = '解鎖系統，恢復所有用戶操作權限'
WHERE command = '/unlock';

UPDATE remote_command_templates SET
  risk_level = 'high',
  impact_description_zh = '切換維護模式，用戶端將顯示維護中頁面'
WHERE command = '/maintenance';

UPDATE remote_command_templates SET
  risk_level = 'high',
  impact_description_zh = '執行退款，款項將退回客戶帳戶，不可逆'
WHERE command = '/refund';

-- 其他指令補齊風險等級
UPDATE remote_command_templates SET risk_level = 'low'
WHERE risk_level IS NULL;

-- ============================================================
-- STEP 3: RPC — queue_approval()
-- ============================================================
CREATE OR REPLACE FUNCTION queue_approval(
  p_command text,
  p_sub_command text DEFAULT NULL,
  p_args jsonb DEFAULT '{}',
  p_request_metadata jsonb DEFAULT '{}',
  p_requester_platform text DEFAULT 'web',
  p_requester_platform_user_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_template record;
  v_requester_binding record;
  v_approver_binding record;
  v_queue_id uuid;
  v_approval_code text;
  v_risk_icon text;
BEGIN
  -- 1. 查指令模板（拿描述 + 風險）
  SELECT * INTO v_template
    FROM remote_command_templates
    WHERE command = p_command AND is_enabled = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', format('未知指令: %s', p_command));
  END IF;

  -- 2. 查請求者 binding
  IF p_requester_platform_user_id IS NOT NULL THEN
    SELECT * INTO v_requester_binding
      FROM remote_command_bindings
      WHERE platform = p_requester_platform
        AND platform_user_id = p_requester_platform_user_id
        AND is_verified = true
      LIMIT 1;
  END IF;

  -- 3. 找老闆（founder 優先，其次 boss）
  SELECT * INTO v_approver_binding
    FROM remote_command_bindings
    WHERE permission_level IN ('founder','boss')
      AND is_verified = true
    ORDER BY
      CASE permission_level WHEN 'founder' THEN 1 WHEN 'boss' THEN 2 END
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '找不到老闆綁定，無法送審');
  END IF;

  -- 4. 風險圖示
  v_risk_icon := CASE v_template.risk_level
    WHEN 'critical' THEN '🔴 極高風險'
    WHEN 'high' THEN '🟠 高風險'
    WHEN 'medium' THEN '🟡 中風險'
    ELSE '🟢 低風險'
  END;

  -- 5. 插入佇列
  INSERT INTO boss_approval_queue (
    command, sub_command, args, request_metadata,
    requester_binding_id, requester_user_id,
    requester_platform, requester_platform_user_id,
    requester_display_name,
    approver_binding_id, approver_user_id, approver_platform,
    command_description_zh, risk_level, impact_description_zh,
    status
  ) VALUES (
    p_command, p_sub_command, p_args, p_request_metadata,
    v_requester_binding.id, v_requester_binding.user_id,
    p_requester_platform, p_requester_platform_user_id,
    COALESCE(v_requester_binding.display_name, p_requester_platform_user_id),
    v_approver_binding.id, v_approver_binding.user_id, v_approver_binding.platform,
    v_template.description_zh, v_template.risk_level, v_template.impact_description_zh,
    'pending'
  )
  RETURNING id, approval_code INTO v_queue_id, v_approval_code;

  -- 6. 日誌
  INSERT INTO remote_command_logs (event_type, details)
  VALUES ('approval_queued', jsonb_build_object(
    'queue_id', v_queue_id,
    'command', p_command,
    'approval_code', v_approval_code,
    'requester', p_requester_platform_user_id,
    'approver_platform', v_approver_binding.platform
  ));

  -- 7. 回傳完整資訊（Worker 用來組通知）
  RETURN jsonb_build_object(
    'success', true,
    'queue_id', v_queue_id,
    'approval_code', v_approval_code,
    'approver_platform', v_approver_binding.platform,
    'approver_chat_id', v_approver_binding.platform_user_id,
    'expires_minutes', 30,
    'command', p_command,
    'sub_command', p_sub_command,
    'args', p_args,
    'description_zh', v_template.description_zh,
    'risk_level', v_template.risk_level,
    'risk_icon', v_risk_icon,
    'impact_description_zh', COALESCE(v_template.impact_description_zh, v_template.description_zh),
    'requester_name', COALESCE(v_requester_binding.display_name, p_requester_platform_user_id, '未知'),
    'requester_platform', p_requester_platform,
    'message', format('指令 %s 已送出審批，等待老闆核准。審批碼: %s', p_command, v_approval_code)
  );
END;
$$;

-- ============================================================
-- STEP 4: RPC — approve_command()
-- ============================================================
CREATE OR REPLACE FUNCTION approve_command(
  p_queue_id uuid DEFAULT NULL,
  p_approval_code text DEFAULT NULL,
  p_approver_platform text DEFAULT NULL,
  p_approver_platform_user_id text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_queue record;
  v_approver_binding record;
  v_result jsonb;
BEGIN
  -- 1. 查審批項目
  IF p_queue_id IS NOT NULL THEN
    SELECT * INTO v_queue FROM boss_approval_queue WHERE id = p_queue_id;
  ELSIF p_approval_code IS NOT NULL THEN
    SELECT * INTO v_queue FROM boss_approval_queue
      WHERE approval_code = upper(p_approval_code)
        AND status IN ('pending','notified')
      ORDER BY created_at DESC LIMIT 1;
  ELSE
    RETURN jsonb_build_object('error', '需要 queue_id 或 approval_code');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '找不到此審批項目');
  END IF;

  -- 2. 過期檢查
  IF v_queue.expires_at < now() THEN
    UPDATE boss_approval_queue SET status = 'expired' WHERE id = v_queue.id;
    RETURN jsonb_build_object('error', format('審批已過期（%s）', v_queue.expires_at));
  END IF;

  -- 3. 狀態檢查
  IF v_queue.status NOT IN ('pending','notified') THEN
    RETURN jsonb_build_object('error', format('審批已處理: %s', v_queue.status));
  END IF;

  -- 4. 驗證審批者身份
  IF p_approver_platform IS NOT NULL AND p_approver_platform_user_id IS NOT NULL THEN
    SELECT * INTO v_approver_binding
      FROM remote_command_bindings
      WHERE platform = p_approver_platform
        AND platform_user_id = p_approver_platform_user_id
        AND is_verified = true
        AND permission_level IN ('founder','boss')
      LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO remote_command_logs (event_type, details)
      VALUES ('approval_unauthorized', jsonb_build_object(
        'queue_id', v_queue.id,
        'platform', p_approver_platform,
        'platform_user_id', p_approver_platform_user_id
      ));
      RETURN jsonb_build_object('error', '權限不足：僅老闆或創辦人可核准');
    END IF;
  END IF;

  -- 5. 標記核准
  UPDATE boss_approval_queue SET
    status = 'approved',
    decision_at = now(),
    decision_reason = COALESCE(p_reason, '老闆核准 via ' || COALESCE(p_approver_platform, 'unknown')),
    approver_binding_id = COALESCE(v_approver_binding.id, approver_binding_id),
    approver_user_id = COALESCE(v_approver_binding.user_id, approver_user_id)
  WHERE id = v_queue.id;

  -- 6. 執行原始指令（走完整 4 層合規閘門）
  BEGIN
    v_result := execute_remote_command(
      v_queue.command,
      jsonb_build_object(
        'user_id', COALESCE(v_approver_binding.user_id, v_queue.approver_user_id)::text,
        'sub_command', v_queue.sub_command,
        'args', v_queue.args,
        'source', COALESCE(p_approver_platform, 'approval'),
        'session_id', format('approval:%s:%s', v_queue.id, extract(epoch from now())::bigint),
        'approval_queue_id', v_queue.id
      )
    );

    UPDATE boss_approval_queue SET
      status = 'executed',
      execution_result = v_result
    WHERE id = v_queue.id;

  EXCEPTION WHEN OTHERS THEN
    UPDATE boss_approval_queue SET
      status = 'failed',
      execution_result = jsonb_build_object('error', SQLERRM)
    WHERE id = v_queue.id;

    v_result := jsonb_build_object('error', SQLERRM);
  END;

  -- 7. 日誌
  INSERT INTO remote_command_logs (event_type, details)
  VALUES ('approval_completed', jsonb_build_object(
    'queue_id', v_queue.id,
    'command', v_queue.command,
    'approver_platform', p_approver_platform,
    'status', CASE WHEN v_result->>'error' IS NULL THEN 'success' ELSE 'failed' END
  ));

  RETURN jsonb_build_object(
    'success', v_result->>'error' IS NULL,
    'queue_id', v_queue.id,
    'command', v_queue.command,
    'result', v_result,
    'requester_platform', v_queue.requester_platform,
    'requester_platform_user_id', v_queue.requester_platform_user_id,
    'message', CASE
      WHEN v_result->>'error' IS NULL
      THEN format('已核准並執行 %s', v_queue.command)
      ELSE format('已核准但執行失敗: %s', v_result->>'error')
    END
  );
END;
$$;

-- ============================================================
-- STEP 5: RPC — reject_command()
-- ============================================================
CREATE OR REPLACE FUNCTION reject_command(
  p_queue_id uuid DEFAULT NULL,
  p_approval_code text DEFAULT NULL,
  p_approver_platform text DEFAULT NULL,
  p_approver_platform_user_id text DEFAULT NULL,
  p_reason text DEFAULT '老闆拒絕'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_queue record;
  v_approver_binding record;
BEGIN
  -- 查審批項目
  IF p_queue_id IS NOT NULL THEN
    SELECT * INTO v_queue FROM boss_approval_queue WHERE id = p_queue_id;
  ELSIF p_approval_code IS NOT NULL THEN
    SELECT * INTO v_queue FROM boss_approval_queue
      WHERE approval_code = upper(p_approval_code)
        AND status IN ('pending','notified')
      ORDER BY created_at DESC LIMIT 1;
  ELSE
    RETURN jsonb_build_object('error', '需要 queue_id 或 approval_code');
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', '找不到此審批項目');
  END IF;

  IF v_queue.status NOT IN ('pending','notified') THEN
    RETURN jsonb_build_object('error', format('審批已處理: %s', v_queue.status));
  END IF;

  -- 驗證身份
  IF p_approver_platform IS NOT NULL AND p_approver_platform_user_id IS NOT NULL THEN
    SELECT * INTO v_approver_binding
      FROM remote_command_bindings
      WHERE platform = p_approver_platform
        AND platform_user_id = p_approver_platform_user_id
        AND is_verified = true
        AND permission_level IN ('founder','boss')
      LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', '權限不足：僅老闆或創辦人可拒絕');
    END IF;
  END IF;

  -- 標記拒絕
  UPDATE boss_approval_queue SET
    status = 'rejected',
    decision_at = now(),
    decision_reason = p_reason
  WHERE id = v_queue.id;

  INSERT INTO remote_command_logs (event_type, details)
  VALUES ('approval_rejected', jsonb_build_object(
    'queue_id', v_queue.id,
    'command', v_queue.command,
    'reason', p_reason,
    'approver_platform', p_approver_platform
  ));

  RETURN jsonb_build_object(
    'success', true,
    'queue_id', v_queue.id,
    'command', v_queue.command,
    'status', 'rejected',
    'reason', p_reason,
    'requester_platform', v_queue.requester_platform,
    'requester_platform_user_id', v_queue.requester_platform_user_id,
    'message', format('已拒絕 %s — %s', v_queue.command, p_reason)
  );
END;
$$;

-- ============================================================
-- STEP 6: RPC — list_pending_approvals()
-- ============================================================
CREATE OR REPLACE FUNCTION list_pending_approvals(
  p_approver_platform text DEFAULT NULL,
  p_approver_platform_user_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'message', '待審批清單',
    'count', count(*),
    'items', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'command', command,
      'description_zh', command_description_zh,
      'risk_level', risk_level,
      'impact', impact_description_zh,
      'approval_code', approval_code,
      'requester', requester_display_name,
      'requester_platform', requester_platform,
      'created_at', created_at,
      'minutes_left', GREATEST(0, EXTRACT(MINUTES FROM expires_at - now())::int)
    ) ORDER BY created_at DESC), '[]'::jsonb)
  ) INTO v_result
  FROM boss_approval_queue
  WHERE status IN ('pending','notified')
    AND expires_at > now();

  RETURN v_result;
END;
$$;

-- ============================================================
-- STEP 7: RPC — expire_stale_approvals()
-- ============================================================
CREATE OR REPLACE FUNCTION expire_stale_approvals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE boss_approval_queue
  SET status = 'expired'
  WHERE status IN ('pending','notified')
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO remote_command_logs (event_type, details)
    VALUES ('approvals_expired', jsonb_build_object('count', v_count));
  END IF;

  RETURN v_count;
END;
$$;

-- ============================================================
-- STEP 8: handle_approval_command() — 給 execute_remote_command 的分派
-- ============================================================
CREATE OR REPLACE FUNCTION handle_approval_command(
  p_command text,
  p_sub text,
  p_args jsonb,
  p_user_id uuid,
  p_perm text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
  v_platform text;
  v_platform_user_id text;
BEGIN
  v_platform := p_args->>'source_platform';
  v_platform_user_id := p_args->>'source_platform_user_id';

  CASE p_command
    WHEN '/approve' THEN
      v_result := approve_command(
        p_approval_code := COALESCE(p_sub, p_args->>'code'),
        p_approver_platform := v_platform,
        p_approver_platform_user_id := v_platform_user_id
      );

    WHEN '/reject' THEN
      v_result := reject_command(
        p_approval_code := COALESCE(p_sub, p_args->>'code'),
        p_approver_platform := v_platform,
        p_approver_platform_user_id := v_platform_user_id,
        p_reason := COALESCE(p_args->>'reason', '老闆拒絕')
      );

    WHEN '/pending' THEN
      v_result := list_pending_approvals(v_platform, v_platform_user_id);

    ELSE
      v_result := jsonb_build_object('error', '未知審批指令');
  END CASE;

  RETURN v_result;
END;
$$;

-- ============================================================
-- STEP 9: 更新 execute_remote_command() — 加 approval-handler
-- ============================================================
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
  -- 0. 解析參數
  v_user_id := NULLIF(request_metadata->>'user_id', '')::uuid;
  v_sub_command := request_metadata->>'sub_command';
  v_args := COALESCE(request_metadata->'args', '{}'::jsonb);
  v_session_id := COALESCE(request_metadata->>'session_id', gen_random_uuid()::text);

  -- 1. 查詢用戶權限
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

  -- 2. 查詢指令模板
  SELECT * INTO v_template
    FROM remote_command_templates
    WHERE command = command_type
      AND is_enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown command: %', command_type;
  END IF;

  -- 3. 權限檢查
  IF NOT check_permission_level(v_permission, v_template.min_permission) THEN
    INSERT INTO remote_command_logs (event_type, details)
    VALUES ('permission_denied', jsonb_build_object(
      'command', command_type, 'user_id', v_user_id,
      'user_level', v_permission, 'required_level', v_template.min_permission
    ));
    RAISE EXCEPTION 'Permission denied. Required: %, yours: %',
      v_template.min_permission, v_permission;
  END IF;

  -- 4. 合規閘門第一層：check_inference_path()
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
      'command', command_type, 'user_id', v_user_id,
      'verdict', v_compliance->>'verdict', 'reason', v_compliance->>'reason'
    ));
    RAISE EXCEPTION 'Compliance: % — %',
      v_compliance->>'verdict', v_compliance->>'reason';
  END IF;

  v_check_id := (v_compliance->>'check_id')::uuid;

  -- 5. 合規閘門第二層：AML
  IF v_template.category = 'payment' AND v_user_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM aml_alerts
      WHERE aml_alerts.user_id = v_user_id
        AND status IN ('pending', 'investigating')
    ) THEN
      INSERT INTO remote_command_logs (event_type, details)
      VALUES ('aml_blocked', jsonb_build_object(
        'command', command_type, 'user_id', v_user_id,
        'reason', 'Active AML alert on account'
      ));
      RAISE EXCEPTION 'AML: Account has active alert. Financial operation blocked.';
    END IF;
  END IF;

  -- 6. 合規閘門第三層：PDPA
  IF v_template.category IN ('user', 'account', 'payment') THEN
    INSERT INTO remote_command_logs (event_type, details)
    VALUES ('pdpa_access_log', jsonb_build_object(
      'command', command_type, 'accessor_id', v_user_id,
      'accessor_permission', v_permission,
      'access_purpose', v_template.description_zh,
      'data_category', v_template.category,
      'session_id', v_session_id
    ));
  END IF;

  -- 7. 寫入指令記錄
  INSERT INTO remote_commands (
    user_id, session_id, command_type, command_data, status,
    parsed_command, parsed_args, permission_level, source
  ) VALUES (
    v_user_id, v_session_id, command_type, request_metadata, 'executing',
    command_type, v_args, v_permission,
    COALESCE(request_metadata->>'source', 'web')
  )
  RETURNING id INTO v_command_id;

  -- 8. 分派執行（新增 approval-handler）
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
    WHEN 'approval-handler' THEN
      v_result := handle_approval_command(command_type, v_sub_command,
        v_args || jsonb_build_object(
          'source_platform', COALESCE(request_metadata->>'source', 'web'),
          'source_platform_user_id', COALESCE(request_metadata->>'source_user_id', '')
        ),
        v_user_id, v_permission);
    ELSE
      RAISE EXCEPTION 'No handler for: %', v_template.handler;
  END CASE;

  -- 9. 更新結果
  UPDATE remote_commands SET
    status = 'completed',
    result = v_result,
    reply_text = v_result->>'message',
    executed_at = now(),
    duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_ts)::int
  WHERE id = v_command_id;

  -- 10. 合規閘門第四層：稽核記錄
  INSERT INTO inference_audit_trail (
    session_id, model_type, model_identifier, task_type,
    input_summary, output_summary,
    path_check_id, inference_status,
    started_at, completed_at
  ) VALUES (
    v_session_id, 'rule_engine',
    'execute_remote_command/' || command_type, 'other',
    jsonb_build_object(
      'command', command_type, 'sub_command', v_sub_command,
      'args', v_args, 'source', COALESCE(request_metadata->>'source', 'web'),
      'user_id', v_user_id
    )::text,
    COALESCE(v_result->>'message', 'no message'),
    v_check_id, 'success', v_start_ts, clock_timestamp()
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
      'error', SQLERRM, 'session_id', v_session_id
    ));

    INSERT INTO inference_audit_trail (
      session_id, model_type, model_identifier, task_type,
      input_summary, output_summary,
      path_check_id, inference_status,
      started_at, completed_at
    ) VALUES (
      v_session_id, 'rule_engine',
      'execute_remote_command/' || command_type, 'other',
      command_type, SQLERRM,
      v_check_id, 'failed', v_start_ts, clock_timestamp()
    );
  END IF;

  RAISE;
END;
$$;

COMMENT ON FUNCTION execute_remote_command(text, jsonb) IS 'Universal Remote Control dispatcher — 4-layer compliance gate + approval-handler';

-- ============================================================
-- STEP 10: 註冊 3 個新指令
-- ============================================================
INSERT INTO remote_command_templates (command, category, description_zh, min_permission, handler, requires_confirmation, cooldown_seconds, usage_example, risk_level, impact_description_zh) VALUES
('/approve', 'approval', '核准待審批指令', 'boss', 'approval-handler', false, 0, '/approve ABC123', 'low', '核准後將立即執行原始指令'),
('/reject',  'approval', '拒絕待審批指令', 'boss', 'approval-handler', false, 0, '/reject ABC123 原因', 'low', '拒絕後指令將不會執行'),
('/pending', 'approval', '查看待審批清單', 'boss', 'approval-handler', false, 3, '/pending', 'low', '僅顯示清單，不會執行任何操作')
ON CONFLICT (command) DO NOTHING;

-- ============================================================
-- STEP 11: 驗證
-- ============================================================
DO $$
DECLARE
  v_table_exists boolean;
  v_commands int;
  v_risk_filled int;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'boss_approval_queue') INTO v_table_exists;

  SELECT count(*) INTO v_commands
    FROM remote_command_templates WHERE category = 'approval';

  SELECT count(*) INTO v_risk_filled
    FROM remote_command_templates WHERE risk_level IS NOT NULL AND impact_description_zh IS NOT NULL AND requires_confirmation = true;

  RAISE NOTICE '=== Migration 030 驗證 ===';
  RAISE NOTICE 'boss_approval_queue 表: %', CASE WHEN v_table_exists THEN 'OK' ELSE 'MISSING' END;
  RAISE NOTICE '審批指令數: % (預期 3)', v_commands;
  RAISE NOTICE '高風險指令已填說明: % (預期 4: lock/unlock/maintenance/refund)', v_risk_filled;
  RAISE NOTICE '=== 老闆手機審批系統 READY ===';
END;
$$;
