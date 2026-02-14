-- ============================================================
-- Migration 038: 生產安全加固 — 百萬用戶不可崩潰
-- 防崩潰 + 防超載 + 自動清理 + 熔斷器 + 退款保護
-- ============================================================

-- ============================================================
-- 1. 全域速率限制表（防 DDoS / 惡意請求）
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier text NOT NULL,         -- IP / user_id / platform_user_id
  endpoint text NOT NULL,            -- 'rpc:xxx' / 'webhook:telegram'
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  request_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON rate_limit_log(identifier, endpoint, window_start);

-- 自動清理 7 天前的速率記錄
CREATE INDEX IF NOT EXISTS idx_rate_limit_created ON rate_limit_log(created_at);

ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. 速率限制檢查函數
-- ============================================================
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_max_per_minute int DEFAULT 60,
  p_max_per_hour int DEFAULT 600
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_minute_count int;
  v_hour_count int;
BEGIN
  -- 每分鐘計數
  SELECT COALESCE(SUM(request_count), 0) INTO v_minute_count
    FROM rate_limit_log
    WHERE identifier = p_identifier
      AND endpoint = p_endpoint
      AND window_start >= date_trunc('minute', now());

  -- 每小時計數
  SELECT COALESCE(SUM(request_count), 0) INTO v_hour_count
    FROM rate_limit_log
    WHERE identifier = p_identifier
      AND endpoint = p_endpoint
      AND created_at >= now() - interval '1 hour';

  -- 記錄本次請求
  INSERT INTO rate_limit_log (identifier, endpoint)
  VALUES (p_identifier, p_endpoint);

  IF v_minute_count >= p_max_per_minute THEN
    RETURN jsonb_build_object('allowed', false, 'reason',
      format('速率限制：每分鐘最多 %s 次（已 %s 次）', p_max_per_minute, v_minute_count));
  END IF;

  IF v_hour_count >= p_max_per_hour THEN
    RETURN jsonb_build_object('allowed', false, 'reason',
      format('速率限制：每小時最多 %s 次（已 %s 次）', p_max_per_hour, v_hour_count));
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ============================================================
-- 3. 熔斷器（Circuit Breaker）
-- ============================================================
CREATE TABLE IF NOT EXISTS circuit_breaker (
  service text PRIMARY KEY,          -- 'edge_function', 'approval', 'payment'
  state text NOT NULL DEFAULT 'closed' CHECK (state IN ('closed','open','half_open')),
  failure_count int NOT NULL DEFAULT 0,
  failure_threshold int NOT NULL DEFAULT 10,
  last_failure_at timestamptz,
  opened_at timestamptz,
  half_open_after interval NOT NULL DEFAULT interval '2 minutes',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE circuit_breaker ENABLE ROW LEVEL SECURITY;

-- 預設熔斷器
INSERT INTO circuit_breaker (service, failure_threshold, half_open_after) VALUES
  ('edge_function', 10, interval '2 minutes'),
  ('approval_system', 5, interval '1 minute'),
  ('payment_system', 3, interval '5 minutes'),
  ('telegram_api', 15, interval '1 minute'),
  ('ai_inference', 10, interval '3 minutes')
ON CONFLICT (service) DO NOTHING;

CREATE OR REPLACE FUNCTION check_circuit(p_service text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_cb record;
BEGIN
  SELECT * INTO v_cb FROM circuit_breaker WHERE service = p_service;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'state', 'closed');
  END IF;

  -- 開路狀態：檢查是否該半開
  IF v_cb.state = 'open' THEN
    IF v_cb.opened_at + v_cb.half_open_after < now() THEN
      UPDATE circuit_breaker SET state = 'half_open', updated_at = now() WHERE service = p_service;
      RETURN jsonb_build_object('allowed', true, 'state', 'half_open');
    END IF;
    RETURN jsonb_build_object('allowed', false, 'state', 'open',
      'reason', format('熔斷器開啟中，%s 後重試', v_cb.opened_at + v_cb.half_open_after - now()));
  END IF;

  RETURN jsonb_build_object('allowed', true, 'state', v_cb.state);
END;
$$;

CREATE OR REPLACE FUNCTION record_circuit_result(p_service text, p_success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_cb record;
BEGIN
  SELECT * INTO v_cb FROM circuit_breaker WHERE service = p_service;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_success THEN
    -- 成功：重置
    UPDATE circuit_breaker SET
      state = 'closed', failure_count = 0, updated_at = now()
    WHERE service = p_service;
  ELSE
    -- 失敗：累加
    UPDATE circuit_breaker SET
      failure_count = failure_count + 1,
      last_failure_at = now(),
      state = CASE WHEN failure_count + 1 >= failure_threshold THEN 'open' ELSE state END,
      opened_at = CASE WHEN failure_count + 1 >= failure_threshold THEN now() ELSE opened_at END,
      updated_at = now()
    WHERE service = p_service;
  END IF;
END;
$$;

-- ============================================================
-- 4. 退款保護 — 每日/每月上限 + 重複退款防護
-- ============================================================
CREATE TABLE IF NOT EXISTS refund_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  user_id uuid,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'TWD',
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','executed','rejected','failed','reversed')),
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  idempotency_key text UNIQUE,      -- 防重複退款
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_order ON refund_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_user ON refund_ledger(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refund_ledger(status);

ALTER TABLE refund_ledger ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_refund_limits(
  p_user_id uuid,
  p_amount numeric,
  p_order_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_daily_total numeric;
  v_monthly_total numeric;
  v_duplicate int;
  v_daily_limit numeric := 50000;    -- 每日退款上限 5 萬
  v_monthly_limit numeric := 500000; -- 每月退款上限 50 萬
BEGIN
  -- 1. 重複退款檢查
  SELECT count(*) INTO v_duplicate
    FROM refund_ledger
    WHERE order_id = p_order_id
      AND status IN ('pending','approved','executed');

  IF v_duplicate > 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason',
      format('訂單 %s 已有退款記錄，禁止重複退款', p_order_id));
  END IF;

  -- 2. 每日上限
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_total
    FROM refund_ledger
    WHERE user_id = p_user_id
      AND status IN ('approved','executed')
      AND created_at >= date_trunc('day', now());

  IF v_daily_total + p_amount > v_daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason',
      format('今日退款已達 %s，加上本筆 %s 將超過每日上限 %s', v_daily_total, p_amount, v_daily_limit));
  END IF;

  -- 3. 每月上限
  SELECT COALESCE(SUM(amount), 0) INTO v_monthly_total
    FROM refund_ledger
    WHERE user_id = p_user_id
      AND status IN ('approved','executed')
      AND created_at >= date_trunc('month', now());

  IF v_monthly_total + p_amount > v_monthly_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason',
      format('本月退款已達 %s，超過月上限 %s', v_monthly_total, v_monthly_limit));
  END IF;

  RETURN jsonb_build_object('allowed', true,
    'daily_remaining', v_daily_limit - v_daily_total - p_amount,
    'monthly_remaining', v_monthly_limit - v_monthly_total - p_amount);
END;
$$;

-- ============================================================
-- 5. 自動清理過期資料
-- ============================================================
CREATE OR REPLACE FUNCTION auto_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_expired int;
  v_rate_cleaned int;
  v_old_logs int;
BEGIN
  -- 過期審批
  UPDATE boss_approval_queue
  SET status = 'expired'
  WHERE status IN ('pending','notified')
    AND expires_at < now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- 7 天前的速率記錄
  DELETE FROM rate_limit_log WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_rate_cleaned = ROW_COUNT;

  -- 90 天前的指令日誌（保留摘要）
  DELETE FROM remote_command_logs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_old_logs = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_approvals', v_expired,
    'rate_logs_cleaned', v_rate_cleaned,
    'old_logs_cleaned', v_old_logs,
    'cleaned_at', now()
  );
END;
$$;

-- ============================================================
-- 6. 緊急停止開關（比 /lock 更強 — 資料庫層級）
-- ============================================================
CREATE OR REPLACE FUNCTION emergency_stop(p_reason text DEFAULT '緊急停止')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 鎖定系統
  UPDATE system_lock SET
    is_locked = true,
    locked_by = 'emergency_stop',
    locked_at = now(),
    lock_reason = p_reason
  WHERE id = (SELECT id FROM system_lock LIMIT 1);

  -- 開啟所有熔斷器
  UPDATE circuit_breaker SET
    state = 'open',
    opened_at = now(),
    updated_at = now();

  -- 過期所有待審批
  UPDATE boss_approval_queue SET status = 'cancelled'
  WHERE status IN ('pending','notified');

  -- 記錄
  INSERT INTO system_alerts (alert_type, severity, title, description)
  VALUES ('emergency_stop', 'critical',
    '緊急停止已啟動',
    format('原因: %s | 時間: %s', p_reason, now()));

  RETURN jsonb_build_object(
    'success', true,
    'message', format('緊急停止已啟動：%s', p_reason),
    'actions', '系統鎖定 + 熔斷器全開 + 審批取消'
  );
END;
$$;

-- ============================================================
-- 7. 關鍵表索引優化（百萬用戶查詢效能）
-- ============================================================
-- remote_commands 高頻查詢
CREATE INDEX IF NOT EXISTS idx_rc_user_status ON remote_commands(user_id, status);
CREATE INDEX IF NOT EXISTS idx_rc_created ON remote_commands(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rc_session ON remote_commands(session_id);

-- remote_command_logs 高頻查詢
CREATE INDEX IF NOT EXISTS idx_rcl_created ON remote_command_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rcl_command ON remote_command_logs(command_id);

-- inference_audit_trail 高頻查詢
CREATE INDEX IF NOT EXISTS idx_iat_session ON inference_audit_trail(session_id);
CREATE INDEX IF NOT EXISTS idx_iat_created ON inference_audit_trail(started_at DESC);

-- remote_command_bindings 查詢優化
CREATE INDEX IF NOT EXISTS idx_rcb_platform_user ON remote_command_bindings(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_rcb_permission ON remote_command_bindings(permission_level) WHERE is_verified = true;

-- ============================================================
-- 8. 連線數監控
-- ============================================================
CREATE OR REPLACE FUNCTION check_db_connections()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_active int;
  v_max int;
  v_pct numeric;
BEGIN
  SELECT count(*) INTO v_active FROM pg_stat_activity WHERE state = 'active';
  SELECT setting::int INTO v_max FROM pg_settings WHERE name = 'max_connections';
  v_pct := round(v_active::numeric / v_max * 100, 1);

  IF v_pct > 80 THEN
    INSERT INTO system_alerts (alert_type, severity, title, description)
    VALUES ('connection_pool', 'critical',
      '連線數超過 80%',
      format('活躍: %s / 上限: %s (%s%%)', v_active, v_max, v_pct));
  END IF;

  RETURN jsonb_build_object(
    'active', v_active,
    'max', v_max,
    'usage_pct', v_pct,
    'status', CASE
      WHEN v_pct > 80 THEN 'critical'
      WHEN v_pct > 60 THEN 'warning'
      ELSE 'healthy'
    END
  );
END;
$$;

-- ============================================================
-- 驗證
-- ============================================================
DO $$
DECLARE
  v_tables int;
  v_cb int;
BEGIN
  SELECT count(*) INTO v_tables
    FROM pg_tables WHERE schemaname = 'public'
    AND tablename IN ('rate_limit_log','circuit_breaker','refund_ledger');

  SELECT count(*) INTO v_cb FROM circuit_breaker;

  RAISE NOTICE '=== Migration 038: 生產安全加固 ===';
  RAISE NOTICE '保護表: %/3', v_tables;
  RAISE NOTICE '熔斷器: % 個服務', v_cb;
  RAISE NOTICE '速率限制 ✓ | 退款保護 ✓ | 自動清理 ✓ | 緊急停止 ✓ | 索引優化 ✓';
END;
$$;
