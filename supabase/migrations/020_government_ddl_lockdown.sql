-- ============================================================
-- Migration 020: 政府級 DDL 鎖死
-- EVENT TRIGGER 攔截所有對政府保護表的 DDL / DROP 操作
-- 即使 superuser 跑 migration 也會被擋
-- 唯一無法攔截：ALTER/DROP EVENT TRIGGER（PostgreSQL 硬限制）
-- Migration: 20260212135145_government_ddl_lockdown
-- ============================================================

-- 1. 修 drift_detection_log CHECK 支援 DDL 違規類型
ALTER TABLE drift_detection_log DROP CONSTRAINT IF EXISTS drift_detection_log_drift_type_check;
ALTER TABLE drift_detection_log ADD CONSTRAINT drift_detection_log_drift_type_check
  CHECK (drift_type IN ('cross_branch', 'skip_layer', 'reverse', 'orphan', 'unauthorized_ddl'));

ALTER TABLE drift_detection_log DROP CONSTRAINT IF EXISTS drift_detection_log_source_layer_check;
ALTER TABLE drift_detection_log ADD CONSTRAINT drift_detection_log_source_layer_check
  CHECK (source_layer IN ('L1', 'L2', 'L3', 'L4', 'DDL', 'DROP'));

ALTER TABLE drift_detection_log DROP CONSTRAINT IF EXISTS drift_detection_log_target_layer_check;
ALTER TABLE drift_detection_log ADD CONSTRAINT drift_detection_log_target_layer_check
  CHECK (target_layer IN ('L1', 'L2', 'L3', 'L4', 'DDL', 'DROP', 'ALTER TABLE', 'DROP TRIGGER', 'DROP POLICY', 'CREATE TRIGGER', 'ALTER TRIGGER'));

-- 2. DDL 攔截函數（ddl_command_end）
CREATE OR REPLACE FUNCTION block_government_ddl()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj record;
  protected_objects text[] := ARRAY[
    'constraint_paths',
    'jurisdiction_boundaries',
    'protect_government_rules',
    'trg_protect_gov_constraint_paths',
    'trg_protect_gov_jurisdiction_boundaries',
    'block_government_ddl',
    'block_government_drop',
    'govt_ddl_guard',
    'govt_drop_guard'
  ];
  obj_name text;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    FOREACH obj_name IN ARRAY protected_objects
    LOOP
      IF obj.object_identity ILIKE '%' || obj_name || '%' THEN
        RAISE EXCEPTION 'GOVERNMENT LOCKDOWN: DDL [%] on protected object [%] is FORBIDDEN.', obj.command_tag, obj.object_identity;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE EVENT TRIGGER govt_ddl_guard ON ddl_command_end
  EXECUTE FUNCTION block_government_ddl();

-- 3. DROP 攔截函數（sql_drop）
CREATE OR REPLACE FUNCTION block_government_drop()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj record;
  protected_objects text[] := ARRAY[
    'constraint_paths',
    'jurisdiction_boundaries',
    'protect_government_rules',
    'trg_protect_gov_constraint_paths',
    'trg_protect_gov_jurisdiction_boundaries',
    'block_government_ddl',
    'block_government_drop',
    'govt_ddl_guard',
    'govt_drop_guard'
  ];
  obj_name text;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    FOREACH obj_name IN ARRAY protected_objects
    LOOP
      IF obj.object_name = obj_name OR obj.object_identity ILIKE '%' || obj_name || '%' THEN
        RAISE EXCEPTION 'GOVERNMENT LOCKDOWN: DROP on protected object [%] is FORBIDDEN.', obj.object_identity;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

CREATE EVENT TRIGGER govt_drop_guard ON sql_drop
  EXECUTE FUNCTION block_government_drop();
