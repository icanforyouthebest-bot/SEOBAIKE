-- ============================================================
-- 修復 check_inference_path: v_matched record 未初始化 bug
-- 改用獨立 v_matched_id uuid 變數 + FOUND 判斷取代 IS NOT NULL
-- Migration: 20260212094319_fix_check_inference_path_v_matched_bug
-- ============================================================

CREATE OR REPLACE FUNCTION check_inference_path(
  p_session_id  text,
  p_l1_id       uuid DEFAULT NULL,
  p_l2_id       uuid DEFAULT NULL,
  p_l3_id       uuid DEFAULT NULL,
  p_l4_id       uuid DEFAULT NULL,
  p_context     jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_matched       record;
  v_verdict       text;
  v_reason        text;
  v_record_id     uuid;
  v_matched_id    uuid := NULL;
  v_parent_id     uuid;
  v_drift_type    text;
BEGIN
  -- -------------------------------------------------------
  -- Step 1: 層級連貫性檢查（防止跨分支飄移）
  -- -------------------------------------------------------
  IF p_l4_id IS NOT NULL AND p_l3_id IS NOT NULL THEN
    SELECT l3_id INTO v_parent_id FROM l4_nodes WHERE id = p_l4_id;
    IF v_parent_id IS DISTINCT FROM p_l3_id THEN
      v_drift_type := 'cross_branch';
      INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
      VALUES (p_session_id, 'L3', p_l3_id, 'L4', p_l4_id, v_drift_type, 'error');
      INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
      VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, 'halted', 'L4 節點不屬於指定 L3，跨分支飄移', p_context);
      RETURN jsonb_build_object('verdict', 'halted', 'reason', 'L4 node does not belong to specified L3 — cross-branch drift detected', 'drift_type', v_drift_type);
    END IF;
  END IF;

  IF p_l3_id IS NOT NULL AND p_l2_id IS NOT NULL THEN
    SELECT l2_id INTO v_parent_id FROM l3_processes WHERE id = p_l3_id;
    IF v_parent_id IS DISTINCT FROM p_l2_id THEN
      v_drift_type := 'cross_branch';
      INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
      VALUES (p_session_id, 'L2', p_l2_id, 'L3', p_l3_id, v_drift_type, 'error');
      INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
      VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, 'halted', 'L3 節點不屬於指定 L2，跨分支飄移', p_context);
      RETURN jsonb_build_object('verdict', 'halted', 'reason', 'L3 node does not belong to specified L2 — cross-branch drift detected', 'drift_type', v_drift_type);
    END IF;
  END IF;

  IF p_l2_id IS NOT NULL AND p_l1_id IS NOT NULL THEN
    SELECT l1_id INTO v_parent_id FROM l2_subcategories WHERE id = p_l2_id;
    IF v_parent_id IS DISTINCT FROM p_l1_id THEN
      v_drift_type := 'cross_branch';
      INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
      VALUES (p_session_id, 'L1', p_l1_id, 'L2', p_l2_id, v_drift_type, 'error');
      INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
      VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, 'halted', 'L2 節點不屬於指定 L1，跨分支飄移', p_context);
      RETURN jsonb_build_object('verdict', 'halted', 'reason', 'L2 node does not belong to specified L1 — cross-branch drift detected', 'drift_type', v_drift_type);
    END IF;
  END IF;

  -- -------------------------------------------------------
  -- Step 2: 跳層偵測
  -- -------------------------------------------------------
  IF p_l4_id IS NOT NULL AND p_l3_id IS NULL THEN
    INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
    VALUES (p_session_id, 'L3', '00000000-0000-0000-0000-000000000000', 'L4', p_l4_id, 'skip_layer', 'warning');
  END IF;

  IF p_l3_id IS NOT NULL AND p_l2_id IS NULL THEN
    INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
    VALUES (p_session_id, 'L2', '00000000-0000-0000-0000-000000000000', 'L3', p_l3_id, 'skip_layer', 'warning');
  END IF;

  -- -------------------------------------------------------
  -- Step 3: 比對 constraint_paths（deny 優先）
  -- -------------------------------------------------------
  SELECT * INTO v_matched
  FROM constraint_paths
  WHERE path_type = 'deny'
    AND (l1_id IS NULL OR l1_id = p_l1_id)
    AND (l2_id IS NULL OR l2_id = p_l2_id)
    AND (l3_id IS NULL OR l3_id = p_l3_id)
    AND (l4_id IS NULL OR l4_id = p_l4_id)
  ORDER BY priority DESC
  LIMIT 1;

  IF FOUND THEN
    v_verdict := 'denied';
    v_reason  := COALESCE(v_matched.reason, '路徑被 constraint_paths deny 規則阻擋');

    INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, matched_path_id, verdict, reason, context_snapshot)
    VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, v_matched.id, v_verdict, v_reason, p_context)
    RETURNING id INTO v_record_id;

    RETURN jsonb_build_object('verdict', v_verdict, 'reason', v_reason, 'matched_path_id', v_matched.id, 'check_id', v_record_id);
  END IF;

  -- 檢查 allow 規則
  IF EXISTS (SELECT 1 FROM constraint_paths WHERE path_type = 'allow' LIMIT 1) THEN
    SELECT * INTO v_matched
    FROM constraint_paths
    WHERE path_type = 'allow'
      AND (l1_id IS NULL OR l1_id = p_l1_id)
      AND (l2_id IS NULL OR l2_id = p_l2_id)
      AND (l3_id IS NULL OR l3_id = p_l3_id)
      AND (l4_id IS NULL OR l4_id = p_l4_id)
    ORDER BY priority DESC
    LIMIT 1;

    IF NOT FOUND THEN
      v_verdict := 'rollback';
      v_reason  := '未匹配任何 allow 規則，推理路徑回退';

      INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
      VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, v_verdict, v_reason, p_context)
      RETURNING id INTO v_record_id;

      RETURN jsonb_build_object('verdict', v_verdict, 'reason', v_reason, 'check_id', v_record_id);
    ELSE
      v_matched_id := v_matched.id;
    END IF;
  END IF;

  -- -------------------------------------------------------
  -- Step 4: 通過 → allowed
  -- -------------------------------------------------------
  v_verdict := 'allowed';
  v_reason  := '路徑通過約束檢查';

  INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, matched_path_id, verdict, reason, context_snapshot)
  VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, v_matched_id, v_verdict, v_reason, p_context)
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object('verdict', v_verdict, 'reason', v_reason, 'check_id', v_record_id);
END;
$$;
