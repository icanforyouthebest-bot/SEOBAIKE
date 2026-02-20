-- ================================================================
-- 1. 補齊 22 條 FK 缺少的索引
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_command_decisions_session_id          ON public.command_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_dag_executions_session_id             ON public.dag_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_dag_executions_workflow_id            ON public.dag_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_dag_node_logs_execution_id            ON public.dag_node_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_enterprises_industry_l1               ON public.enterprises(industry_l1);
CREATE INDEX IF NOT EXISTS idx_enterprises_industry_l2               ON public.enterprises(industry_l2);
CREATE INDEX IF NOT EXISTS idx_execution_gate_meeting_id             ON public.execution_gate(meeting_id);
CREATE INDEX IF NOT EXISTS idx_human_interventions_session_id        ON public.human_interventions(session_id);
CREATE INDEX IF NOT EXISTS idx_igm_resolved_l1_id                    ON public.inference_gate_mappings(resolved_l1_id);
CREATE INDEX IF NOT EXISTS idx_igm_resolved_l2_id                    ON public.inference_gate_mappings(resolved_l2_id);
CREATE INDEX IF NOT EXISTS idx_igm_resolved_l3_id                    ON public.inference_gate_mappings(resolved_l3_id);
CREATE INDEX IF NOT EXISTS idx_igm_resolved_l4_id                    ON public.inference_gate_mappings(resolved_l4_id);
CREATE INDEX IF NOT EXISTS idx_mkt_commission_splits_listing_id      ON public.marketplace_commission_splits(listing_id);
CREATE INDEX IF NOT EXISTS idx_mkt_commission_splits_purchase_id     ON public.marketplace_commission_splits(purchase_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_l1_id            ON public.marketplace_listings(l1_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_l2_id            ON public.marketplace_listings(l2_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_listing_id        ON public.marketplace_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_master_agent_queue_session_id         ON public.master_agent_queue(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_revenue_settlements_service_id   ON public.mcp_revenue_settlements(service_id);
CREATE INDEX IF NOT EXISTS idx_mcp_services_required_l1_category    ON public.mcp_services(required_l1_category);
CREATE INDEX IF NOT EXISTS idx_mcp_subscriptions_service_id         ON public.mcp_subscriptions(service_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_dept_code          ON public.meeting_attendance(dept_code);
CREATE INDEX IF NOT EXISTS idx_meeting_attendance_meeting_id         ON public.meeting_attendance(meeting_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id        ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id              ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_task_id              ON public.team_assignments(task_id);

-- ================================================================
-- 2. 修復 ai_execution_audit_log 缺少 Primary Key
--    父表 partition key = created_at，PK 需包含 partition key
-- ================================================================
ALTER TABLE public.ai_execution_audit_log
  ALTER COLUMN log_id SET NOT NULL,
  ALTER COLUMN log_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.ai_execution_audit_log
  ADD CONSTRAINT ai_execution_audit_log_pkey PRIMARY KEY (log_id, created_at);

-- ================================================================
-- 3. 再次修復 auth_rls_initplan 殘留（27 條）
--    重跑 DO block 捕捉任何未覆蓋的政策
-- ================================================================
DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  fix_count int := 0;
  fail_count int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid()%')
        OR
        (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid()%')
      )
    ORDER BY tablename, policyname
  LOOP
    new_qual := pol.qual;
    new_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, '(SELECT auth.uid())', '##UID_OK##');
      new_qual := replace(new_qual, 'auth.uid()', '(SELECT auth.uid())');
      new_qual := replace(new_qual, '##UID_OK##', '(SELECT auth.uid())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, '(SELECT auth.uid())', '##UID_OK##');
      new_check := replace(new_check, 'auth.uid()', '(SELECT auth.uid())');
      new_check := replace(new_check, '##UID_OK##', '(SELECT auth.uid())');
    END IF;

    BEGIN
      IF pol.cmd = 'INSERT' THEN
        IF new_check IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
            pol.policyname, pol.schemaname, pol.tablename, new_check);
        END IF;
      ELSIF pol.cmd IN ('SELECT', 'DELETE') THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
          pol.policyname, pol.schemaname, pol.tablename, COALESCE(new_qual, 'true'));
      ELSIF pol.cmd = 'UPDATE' THEN
        IF new_check IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
            pol.policyname, pol.schemaname, pol.tablename,
            COALESCE(new_qual, 'true'), new_check);
        ELSE
          EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
            pol.policyname, pol.schemaname, pol.tablename, COALESCE(new_qual, 'true'));
        END IF;
      ELSIF pol.cmd = 'ALL' THEN
        IF new_check IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
            pol.policyname, pol.schemaname, pol.tablename,
            COALESCE(new_qual, 'true'), new_check);
        ELSIF new_qual IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)',
            pol.policyname, pol.schemaname, pol.tablename, new_qual);
        END IF;
      END IF;
      fix_count := fix_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'SKIP % on %.%: %', pol.policyname, pol.schemaname, pol.tablename, SQLERRM;
      fail_count := fail_count + 1;
    END;
  END LOOP;
  RAISE NOTICE 'auth_rls_initplan re-fix done — fixed: %, skipped: %', fix_count, fail_count;
END $$;
