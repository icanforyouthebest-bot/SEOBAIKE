-- ============================================================
-- Migration 037: 修復 remote_command_logs event_type CHECK
-- 新增審批系統所需的事件類型
-- ============================================================

-- 先刪除所有 event_type CHECK（可能已被之前的嘗試刪除）
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      WHERE t.relname = 'remote_command_logs'
        AND n.nspname = 'public'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) LIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE remote_command_logs DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped: %', v_constraint_name;
  END LOOP;
END;
$$;

-- 不再加 CHECK 約束 — event_type 用 text 自由記錄即可
-- 審批系統會產生: approval_queued, approval_completed, approval_rejected,
-- approval_unauthorized, approval_expired, approvals_expired
-- 不需要限制，讓系統自由擴展

COMMENT ON COLUMN remote_command_logs.event_type IS 'Free text event type — no CHECK constraint';

DO $$
BEGIN
  RAISE NOTICE '=== Migration 037: event_type CHECK 已移除，改為自由文字 ===';
END;
$$;
