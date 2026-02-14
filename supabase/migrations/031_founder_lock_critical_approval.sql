-- ============================================================
-- Migration 031: 創辦人權限鎖定
-- critical 等級指令只有 founder 能審批，boss 不行
-- /refund 升級為 founder 才能審批
-- ============================================================

-- 1. /refund 升級為 founder 限定
UPDATE remote_command_templates SET
  min_permission = 'founder'
WHERE command = '/refund';

-- 2. /approve /reject 升級為 founder 限定
UPDATE remote_command_templates SET
  min_permission = 'founder'
WHERE command IN ('/approve', '/reject');

-- 3. 重建 approve_command() — critical/high 必須 founder
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

    -- ★ 創辦人鎖定：critical/high 風險只有 founder 能審批
    IF v_queue.risk_level IN ('critical', 'high') AND v_approver_binding.permission_level != 'founder' THEN
      INSERT INTO remote_command_logs (event_type, details)
      VALUES ('approval_unauthorized', jsonb_build_object(
        'queue_id', v_queue.id,
        'reason', 'critical/high risk requires founder',
        'approver_level', v_approver_binding.permission_level,
        'risk_level', v_queue.risk_level
      ));
      RETURN jsonb_build_object('error', format('權限不足：%s 等級指令僅創辦人可核准', v_queue.risk_level));
    END IF;
  END IF;

  -- 5. 標記核准
  UPDATE boss_approval_queue SET
    status = 'approved',
    decision_at = now(),
    decision_reason = COALESCE(p_reason, '創辦人核准 via ' || COALESCE(p_approver_platform, 'unknown')),
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
    'approver_level', COALESCE(v_approver_binding.permission_level, 'unknown'),
    'risk_level', v_queue.risk_level,
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

-- 4. 同樣鎖定 reject_command()
CREATE OR REPLACE FUNCTION reject_command(
  p_queue_id uuid DEFAULT NULL,
  p_approval_code text DEFAULT NULL,
  p_approver_platform text DEFAULT NULL,
  p_approver_platform_user_id text DEFAULT NULL,
  p_reason text DEFAULT '創辦人拒絕'
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

    -- ★ 創辦人鎖定
    IF v_queue.risk_level IN ('critical', 'high') AND v_approver_binding.permission_level != 'founder' THEN
      RETURN jsonb_build_object('error', format('權限不足：%s 等級指令僅創辦人可拒絕', v_queue.risk_level));
    END IF;
  END IF;

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
    'approver_platform', p_approver_platform,
    'risk_level', v_queue.risk_level
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

-- 5. 驗證
DO $$
DECLARE
  v_founder_only int;
BEGIN
  SELECT count(*) INTO v_founder_only
    FROM remote_command_templates
    WHERE min_permission = 'founder'
      AND command IN ('/lock','/unlock','/maintenance','/refund','/approve','/reject');

  RAISE NOTICE '=== Migration 031 驗證 ===';
  RAISE NOTICE 'founder 限定指令: % (預期 6)', v_founder_only;
  RAISE NOTICE 'critical/high 審批已鎖定為 founder only';
  RAISE NOTICE '=== 創辦人權限鎖定 DONE ===';
END;
$$;
