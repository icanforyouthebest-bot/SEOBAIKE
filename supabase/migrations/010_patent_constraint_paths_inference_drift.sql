-- ============================================================
-- SEOBAIKE 專利 115100981 補齊：約束路徑 / 推理判斷 / 管轄邊界 / 飄移偵測
-- Migration: 20260212093952_patent_constraint_paths_inference_drift
-- ============================================================

-- ============================================================
-- 1. constraint_paths：允許 / 禁止的推理路徑定義
-- ============================================================
CREATE TABLE constraint_paths (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  l1_id       uuid REFERENCES l1_categories(id)    ON DELETE RESTRICT,
  l2_id       uuid REFERENCES l2_subcategories(id)  ON DELETE RESTRICT,
  l3_id       uuid REFERENCES l3_processes(id)      ON DELETE RESTRICT,
  l4_id       uuid REFERENCES l4_nodes(id)          ON DELETE RESTRICT,
  path_type   text NOT NULL CHECK (path_type IN ('allow', 'deny')),
  priority    int  NOT NULL DEFAULT 0,
  reason      text,
  is_frozen   boolean DEFAULT false,
  frozen_at   timestamptz,
  created_by  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_cp_l1       ON constraint_paths (l1_id);
CREATE INDEX idx_cp_l2       ON constraint_paths (l2_id);
CREATE INDEX idx_cp_l3       ON constraint_paths (l3_id);
CREATE INDEX idx_cp_l4       ON constraint_paths (l4_id);
CREATE INDEX idx_cp_type     ON constraint_paths (path_type);
CREATE INDEX idx_cp_priority ON constraint_paths (priority DESC);

CREATE TRIGGER trg_cp_updated_at
  BEFORE UPDATE ON constraint_paths
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cp_protect_frozen
  BEFORE UPDATE OR DELETE ON constraint_paths
  FOR EACH ROW EXECUTE FUNCTION protect_frozen_row();

COMMENT ON TABLE constraint_paths IS '專利約束路徑：定義 L1→L4 允許/禁止推理路線';

-- ============================================================
-- 2. inference_path_checks：推理路徑查詢判斷紀錄
-- ============================================================
CREATE TABLE inference_path_checks (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       text NOT NULL,
  requested_l1_id  uuid REFERENCES l1_categories(id),
  requested_l2_id  uuid REFERENCES l2_subcategories(id),
  requested_l3_id  uuid REFERENCES l3_processes(id),
  requested_l4_id  uuid REFERENCES l4_nodes(id),
  matched_path_id  uuid REFERENCES constraint_paths(id),
  verdict          text NOT NULL CHECK (verdict IN ('allowed', 'denied', 'halted', 'rollback')),
  reason           text,
  context_snapshot jsonb,
  checked_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_ipc_session   ON inference_path_checks (session_id);
CREATE INDEX idx_ipc_verdict   ON inference_path_checks (verdict);
CREATE INDEX idx_ipc_checked   ON inference_path_checks (checked_at DESC);
CREATE INDEX idx_ipc_l4        ON inference_path_checks (requested_l4_id);

COMMENT ON TABLE inference_path_checks IS '推理路徑判斷紀錄：記錄每次 AI 路徑查詢的結果（允許/拒絕/中止/回退）';

-- ============================================================
-- 3. jurisdiction_boundaries：管轄邊界
-- ============================================================
CREATE TABLE jurisdiction_boundaries (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  jurisdiction_code text NOT NULL,
  jurisdiction_name text NOT NULL,
  country_iso2     text NOT NULL CHECK (char_length(country_iso2) = 2),
  region           text,
  applicable_l1_id uuid REFERENCES l1_categories(id),
  applicable_l2_id uuid REFERENCES l2_subcategories(id),
  applicable_l3_id uuid REFERENCES l3_processes(id),
  applicable_l4_id uuid REFERENCES l4_nodes(id),
  boundary_type    text NOT NULL CHECK (boundary_type IN ('include', 'exclude')),
  legal_reference  text,
  effective_from   date NOT NULL DEFAULT CURRENT_DATE,
  effective_until  date,
  is_frozen        boolean DEFAULT false,
  frozen_at        timestamptz,
  created_by       text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX idx_jb_code       ON jurisdiction_boundaries (jurisdiction_code);
CREATE INDEX idx_jb_country    ON jurisdiction_boundaries (country_iso2);
CREATE INDEX idx_jb_type       ON jurisdiction_boundaries (boundary_type);
CREATE INDEX idx_jb_effective  ON jurisdiction_boundaries (effective_from, effective_until);
CREATE INDEX idx_jb_l1         ON jurisdiction_boundaries (applicable_l1_id);
CREATE INDEX idx_jb_l4         ON jurisdiction_boundaries (applicable_l4_id);

CREATE TRIGGER trg_jb_updated_at
  BEFORE UPDATE ON jurisdiction_boundaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_jb_protect_frozen
  BEFORE UPDATE OR DELETE ON jurisdiction_boundaries
  FOR EACH ROW EXECUTE FUNCTION protect_frozen_row();

COMMENT ON TABLE jurisdiction_boundaries IS '管轄邊界：定義各約束節點在哪些法域有效或排除';

-- ============================================================
-- 4. drift_detection_log：跨層飄移偵測紀錄
-- ============================================================
CREATE TABLE drift_detection_log (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      text NOT NULL,
  source_layer    text NOT NULL CHECK (source_layer IN ('L1', 'L2', 'L3', 'L4')),
  source_node_id  uuid NOT NULL,
  target_layer    text NOT NULL CHECK (target_layer IN ('L1', 'L2', 'L3', 'L4')),
  target_node_id  uuid NOT NULL,
  drift_type      text NOT NULL CHECK (drift_type IN ('skip_layer', 'cross_branch', 'reverse', 'orphan')),
  severity        text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'error', 'critical')),
  auto_corrected  boolean DEFAULT false,
  correction_detail text,
  context_snapshot jsonb,
  detected_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_ddl_session   ON drift_detection_log (session_id);
CREATE INDEX idx_ddl_drift     ON drift_detection_log (drift_type);
CREATE INDEX idx_ddl_severity  ON drift_detection_log (severity);
CREATE INDEX idx_ddl_detected  ON drift_detection_log (detected_at DESC);
CREATE INDEX idx_ddl_source    ON drift_detection_log (source_layer, source_node_id);
CREATE INDEX idx_ddl_target    ON drift_detection_log (target_layer, target_node_id);

COMMENT ON TABLE drift_detection_log IS '跨層飄移偵測：記錄 AI 推理的非預期跳躍（跳層/跨分支/逆向/孤立）';

-- ============================================================
-- 5. RLS 啟用 + Policies
-- ============================================================

-- constraint_paths
ALTER TABLE constraint_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY cp_select_authenticated
  ON constraint_paths FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY cp_all_admin
  ON constraint_paths FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  );

-- inference_path_checks
ALTER TABLE inference_path_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY ipc_insert_authenticated
  ON inference_path_checks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY ipc_select_authenticated
  ON inference_path_checks FOR SELECT
  TO authenticated
  USING (true);

-- jurisdiction_boundaries
ALTER TABLE jurisdiction_boundaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY jb_select_authenticated
  ON jurisdiction_boundaries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY jb_all_admin
  ON jurisdiction_boundaries FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'boss', 'president'))
  );

-- drift_detection_log
ALTER TABLE drift_detection_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY ddl_insert_authenticated
  ON drift_detection_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY ddl_select_authenticated
  ON drift_detection_log FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 6. check_inference_path() 函數（初版）
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
AS $$
DECLARE
  v_matched    record;
  v_verdict    text;
  v_reason     text;
  v_record_id  uuid;
  v_l2_parent  uuid;
  v_l3_parent  uuid;
  v_l4_parent  uuid;
  v_drift_type text;
BEGIN
  -- Step 1: 層級連貫性檢查（防止跨分支飄移）
  IF p_l4_id IS NOT NULL AND p_l3_id IS NOT NULL THEN
    SELECT l3_id INTO v_l4_parent FROM l4_nodes WHERE id = p_l4_id;
    IF v_l4_parent IS DISTINCT FROM p_l3_id THEN
      v_drift_type := 'cross_branch';
      INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
      VALUES (p_session_id, 'L3', p_l3_id, 'L4', p_l4_id, v_drift_type, 'error');
      INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
      VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, 'halted', 'L4 節點不屬於指定 L3，跨分支飄移', p_context);
      RETURN jsonb_build_object('verdict', 'halted', 'reason', 'L4 node does not belong to specified L3 — cross-branch drift detected', 'drift_type', v_drift_type);
    END IF;
  END IF;

  IF p_l3_id IS NOT NULL AND p_l2_id IS NOT NULL THEN
    SELECT l2_id INTO v_l3_parent FROM l3_processes WHERE id = p_l3_id;
    IF v_l3_parent IS DISTINCT FROM p_l2_id THEN
      v_drift_type := 'cross_branch';
      INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
      VALUES (p_session_id, 'L2', p_l2_id, 'L3', p_l3_id, v_drift_type, 'error');
      INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
      VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, 'halted', 'L3 節點不屬於指定 L2，跨分支飄移', p_context);
      RETURN jsonb_build_object('verdict', 'halted', 'reason', 'L3 node does not belong to specified L2 — cross-branch drift detected', 'drift_type', v_drift_type);
    END IF;
  END IF;

  IF p_l2_id IS NOT NULL AND p_l1_id IS NOT NULL THEN
    SELECT l1_id INTO v_l2_parent FROM l2_subcategories WHERE id = p_l2_id;
    IF v_l2_parent IS DISTINCT FROM p_l1_id THEN
      v_drift_type := 'cross_branch';
      INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
      VALUES (p_session_id, 'L1', p_l1_id, 'L2', p_l2_id, v_drift_type, 'error');
      INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
      VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, 'halted', 'L2 節點不屬於指定 L1，跨分支飄移', p_context);
      RETURN jsonb_build_object('verdict', 'halted', 'reason', 'L2 node does not belong to specified L1 — cross-branch drift detected', 'drift_type', v_drift_type);
    END IF;
  END IF;

  -- Step 2: 跳層偵測
  IF p_l4_id IS NOT NULL AND p_l3_id IS NULL THEN
    INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
    VALUES (p_session_id, 'L3', '00000000-0000-0000-0000-000000000000', 'L4', p_l4_id, 'skip_layer', 'warning');
  END IF;

  IF p_l3_id IS NOT NULL AND p_l2_id IS NULL THEN
    INSERT INTO drift_detection_log (session_id, source_layer, source_node_id, target_layer, target_node_id, drift_type, severity)
    VALUES (p_session_id, 'L2', '00000000-0000-0000-0000-000000000000', 'L3', p_l3_id, 'skip_layer', 'warning');
  END IF;

  -- Step 3: 比對 constraint_paths（deny 優先）
  SELECT * INTO v_matched
  FROM constraint_paths
  WHERE path_type = 'deny'
    AND (l1_id IS NULL OR l1_id = p_l1_id)
    AND (l2_id IS NULL OR l2_id = p_l2_id)
    AND (l3_id IS NULL OR l3_id = p_l3_id)
    AND (l4_id IS NULL OR l4_id = p_l4_id)
  ORDER BY priority DESC
  LIMIT 1;

  IF v_matched.id IS NOT NULL THEN
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

    IF v_matched.id IS NULL THEN
      v_verdict := 'rollback';
      v_reason  := '未匹配任何 allow 規則，推理路徑回退';

      INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, verdict, reason, context_snapshot)
      VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, v_verdict, v_reason, p_context)
      RETURNING id INTO v_record_id;

      RETURN jsonb_build_object('verdict', v_verdict, 'reason', v_reason, 'check_id', v_record_id);
    END IF;
  ELSE
    v_matched := NULL;
  END IF;

  -- Step 4: 通過
  v_verdict := 'allowed';
  v_reason  := '路徑通過約束檢查';

  INSERT INTO inference_path_checks (session_id, requested_l1_id, requested_l2_id, requested_l3_id, requested_l4_id, matched_path_id, verdict, reason, context_snapshot)
  VALUES (p_session_id, p_l1_id, p_l2_id, p_l3_id, p_l4_id, CASE WHEN v_matched IS NOT NULL THEN v_matched.id ELSE NULL END, v_verdict, v_reason, p_context)
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object('verdict', v_verdict, 'reason', v_reason, 'check_id', v_record_id);
END;
$$;

COMMENT ON FUNCTION check_inference_path IS '專利核心函數：驗證 AI 推理路徑是否合規，執行 允許/中止/回退 判斷';

-- ============================================================
-- 7. 欄位註解
-- ============================================================
COMMENT ON COLUMN constraint_paths.path_type IS 'allow = 允許此路徑, deny = 禁止此路徑';
COMMENT ON COLUMN constraint_paths.priority IS '優先序，數字越大越優先（deny 整體優先於 allow）';
COMMENT ON COLUMN inference_path_checks.verdict IS 'allowed=通過 / denied=拒絕 / halted=中止 / rollback=回退';
COMMENT ON COLUMN drift_detection_log.drift_type IS 'skip_layer=跳層 / cross_branch=跨分支 / reverse=逆向 / orphan=孤立';
COMMENT ON COLUMN jurisdiction_boundaries.boundary_type IS 'include=此管轄區適用 / exclude=此管轄區排除';
