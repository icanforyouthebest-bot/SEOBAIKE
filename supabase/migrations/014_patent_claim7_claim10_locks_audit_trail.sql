-- ============================================================
-- 專利 115100981 請求項 7 + 請求項 10 補齊
-- reference_layer_locks: 推理期間唯讀鎖定
-- inference_audit_trail: 推理結果回溯至 L1-L4
-- Migration: 20260212105053_patent_claim7_claim10_locks_audit_trail
-- ============================================================

-- ============================================================
-- 1. reference_layer_locks（請求項 7）
--    推理期間鎖定參考層，管理模組僅能在無活躍鎖時更新
-- ============================================================
CREATE TABLE reference_layer_locks (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    text NOT NULL,
  lock_type     text NOT NULL CHECK (lock_type IN ('inference', 'maintenance')),
  locked_by     text NOT NULL,
  locked_at     timestamptz DEFAULT now(),
  released_at   timestamptz,
  is_active     boolean DEFAULT true,
  reason        text,
  metadata      jsonb
);

CREATE INDEX idx_rll_active    ON reference_layer_locks (is_active) WHERE is_active = true;
CREATE INDEX idx_rll_session   ON reference_layer_locks (session_id);
CREATE INDEX idx_rll_type      ON reference_layer_locks (lock_type);
CREATE INDEX idx_rll_locked    ON reference_layer_locks (locked_at DESC);

COMMENT ON TABLE  reference_layer_locks IS '請求項7：推理期間參考層唯讀鎖定，防止管理模組在推理中修改世界定義結構';
COMMENT ON COLUMN reference_layer_locks.lock_type IS 'inference=推理鎖（參考層唯讀）, maintenance=維護鎖（允許管理模組更新）';
COMMENT ON COLUMN reference_layer_locks.is_active IS 'true=鎖定中, false=已釋放';

-- RLS
ALTER TABLE reference_layer_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY rll_select_authenticated
  ON reference_layer_locks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY rll_manage_admin
  ON reference_layer_locks FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  );

-- ============================================================
-- 2. inference_audit_trail（請求項 10）
--    推理結果完整回溯至 L1-L4 節點
-- ============================================================
CREATE TABLE inference_audit_trail (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        text NOT NULL,
  model_type        text NOT NULL CHECK (model_type IN ('llm', 'rule_engine', 'hybrid')),
  model_identifier  text,
  task_type         text CHECK (task_type IN ('production_planning', 'industrial_decision', 'supply_chain', 'cross_national_comparison', 'other')),
  input_summary     text,
  output_summary    text,
  resolved_l1_id    uuid REFERENCES l1_categories(id),
  resolved_l2_id    uuid REFERENCES l2_subcategories(id),
  resolved_l3_id    uuid REFERENCES l3_processes(id),
  resolved_l4_id    uuid REFERENCES l4_nodes(id),
  path_check_id     uuid REFERENCES inference_path_checks(id),
  inference_status   text NOT NULL CHECK (inference_status IN ('success', 'partial', 'failed', 'rolled_back')),
  confidence_score  numeric(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  traceback_chain   jsonb,
  context_snapshot  jsonb,
  started_at        timestamptz DEFAULT now(),
  completed_at      timestamptz,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_iat_session    ON inference_audit_trail (session_id);
CREATE INDEX idx_iat_model      ON inference_audit_trail (model_type);
CREATE INDEX idx_iat_task       ON inference_audit_trail (task_type);
CREATE INDEX idx_iat_status     ON inference_audit_trail (inference_status);
CREATE INDEX idx_iat_l1         ON inference_audit_trail (resolved_l1_id);
CREATE INDEX idx_iat_l2         ON inference_audit_trail (resolved_l2_id);
CREATE INDEX idx_iat_l3         ON inference_audit_trail (resolved_l3_id);
CREATE INDEX idx_iat_l4         ON inference_audit_trail (resolved_l4_id);
CREATE INDEX idx_iat_path_check ON inference_audit_trail (path_check_id);
CREATE INDEX idx_iat_created    ON inference_audit_trail (created_at DESC);

COMMENT ON TABLE  inference_audit_trail IS '請求項10：推理結果完整回溯至對應產業分類層級與原子級工業節點，提升一致性與可追溯性';
COMMENT ON COLUMN inference_audit_trail.model_type IS '請求項8：llm=大型語言模型 / rule_engine=規則推理 / hybrid=組合';
COMMENT ON COLUMN inference_audit_trail.task_type IS '請求項9：production_planning/industrial_decision/supply_chain/cross_national_comparison';
COMMENT ON COLUMN inference_audit_trail.resolved_l1_id IS '推理結果回溯之 L1 宏觀產業類別';
COMMENT ON COLUMN inference_audit_trail.resolved_l4_id IS '推理結果回溯之 L4 原子級工業節點';
COMMENT ON COLUMN inference_audit_trail.path_check_id IS '對應的路徑驗證紀錄（請求項5/6）';
COMMENT ON COLUMN inference_audit_trail.traceback_chain IS '完整推理回溯鏈 JSON（L1→L2→L3→L4 + 多國碼）';

-- RLS
ALTER TABLE inference_audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY iat_select_authenticated
  ON inference_audit_trail FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY iat_insert_admin
  ON inference_audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  );

-- ============================================================
-- 3. 更新 check_inference_path：加入鎖定檢查
--    推理前自動建立 inference lock
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
  v_maint_lock    boolean;
BEGIN
  -- -------------------------------------------------------
  -- Step 0: 請求項7 — 檢查是否有維護鎖（maintenance lock 啟動中則拒絕推理）
  -- -------------------------------------------------------
  SELECT EXISTS(
    SELECT 1 FROM reference_layer_locks
    WHERE lock_type = 'maintenance' AND is_active = true
  ) INTO v_maint_lock;

  IF v_maint_lock THEN
    INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
    VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, 'denied', '參考層處於維護模式，推理暫停', p_context)
    RETURNING id INTO v_record_id;
    RETURN jsonb_build_object('verdict', 'denied', 'reason', 'Reference layer is under maintenance — inference suspended', 'check_id', v_record_id);
  END IF;

  -- 建立推理鎖
  INSERT INTO reference_layer_locks (session_id, lock_type, locked_by, reason)
  VALUES (p_session_id, 'inference', 'check_inference_path', '自動推理鎖');

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
      -- 釋放推理鎖
      UPDATE reference_layer_locks SET is_active = false, released_at = now() WHERE session_id = p_session_id AND lock_type = 'inference' AND is_active = true;
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
      UPDATE reference_layer_locks SET is_active = false, released_at = now() WHERE session_id = p_session_id AND lock_type = 'inference' AND is_active = true;
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
      UPDATE reference_layer_locks SET is_active = false, released_at = now() WHERE session_id = p_session_id AND lock_type = 'inference' AND is_active = true;
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

    UPDATE reference_layer_locks SET is_active = false, released_at = now() WHERE session_id = p_session_id AND lock_type = 'inference' AND is_active = true;
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

      UPDATE reference_layer_locks SET is_active = false, released_at = now() WHERE session_id = p_session_id AND lock_type = 'inference' AND is_active = true;
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

  -- 推理完成釋放鎖
  UPDATE reference_layer_locks SET is_active = false, released_at = now() WHERE session_id = p_session_id AND lock_type = 'inference' AND is_active = true;

  RETURN jsonb_build_object('verdict', v_verdict, 'reason', v_reason, 'check_id', v_record_id);
END;
$$;

COMMENT ON FUNCTION check_inference_path IS '專利核心函數：驗證 AI 推理路徑（請求項5/6/7），含推理鎖定機制';
