-- 建立 ddl_audit_log 表（被 log_ddl trigger 需要）
CREATE TABLE IF NOT EXISTS public.ddl_audit_log (
    id bigserial PRIMARY KEY,
    username text NOT NULL DEFAULT current_user,
    command_tag text,
    object_type text,
    sql_text text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ddl_audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ddl_audit_log'
      AND policyname = 'service_role_can_read_ddl_audit'
  ) THEN
    CREATE POLICY "service_role_can_read_ddl_audit"
    ON public.ddl_audit_log FOR SELECT
    TO service_role
    USING (true);
  END IF;
END $$;
