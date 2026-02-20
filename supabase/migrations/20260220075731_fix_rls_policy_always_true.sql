-- 修復 rls_policy_always_true：將所有 WITH CHECK (true) / USING (true) 改為有意義條件

-- ① contact_submissions — 公開聯絡表單（anon + authenticated）
ALTER POLICY "public_insert"
  ON public.contact_submissions
  WITH CHECK (
    email IS NOT NULL
    AND name IS NOT NULL
    AND length(trim(message)) > 0
  );

-- ② newsletter_subscriptions — 公開訂閱（anon）
ALTER POLICY "anon_insert_newsletter"
  ON public.newsletter_subscriptions
  WITH CHECK (
    email IS NOT NULL
    AND email LIKE '%@%.%'
  );

-- ③ page_views — 公開瀏覽追蹤（anon + authenticated）
ALTER POLICY "public_track"
  ON public.page_views
  WITH CHECK (
    path IS NOT NULL
    AND length(path) > 0
  );

-- ④ billing_accounts — 必須登入才能建立
ALTER POLICY "Public insert billing"
  ON public.billing_accounts
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
  );

-- ⑤ billing_invoices — 必須登入才能建立
ALTER POLICY "Public insert invoices"
  ON public.billing_invoices
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
  );

-- ⑥ sp_topups — 必須登入，且金額/點數 > 0
ALTER POLICY "Public insert topups"
  ON public.sp_topups
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND sp_amount > 0
    AND price_twd > 0
  );

-- ⑦ boss_api_usage_logs — 要求 provider 與 model 必填
ALTER POLICY "boss_api_usage_logs_public_insert"
  ON public.boss_api_usage_logs
  WITH CHECK (
    provider IS NOT NULL
    AND model IS NOT NULL
  );

-- ⑧ announcements — 要求 title 與 created_by 必填
ALTER POLICY "announcements_insert"
  ON public.announcements
  WITH CHECK (
    title IS NOT NULL
    AND created_by IS NOT NULL
  );

-- ⑨ frozen_accounts — 要求 user_id / reason / frozen_by 必填
ALTER POLICY "frozen_insert"
  ON public.frozen_accounts
  WITH CHECK (
    user_id IS NOT NULL
    AND reason IS NOT NULL
    AND frozen_by IS NOT NULL
  );

-- ⑩ inference_gate_log — 要求 function_slug 與合法 verdict
ALTER POLICY "igl_insert"
  ON public.inference_gate_log
  WITH CHECK (
    function_slug IS NOT NULL
    AND verdict IN ('allowed', 'denied', 'halted', 'rollback')
  );

-- ⑪ seo_points_transactions — 要求 user_id / amount 非零 / type / created_by 必填
ALTER POLICY "points_tx_insert"
  ON public.seo_points_transactions
  WITH CHECK (
    user_id IS NOT NULL
    AND amount <> 0
    AND type IS NOT NULL
    AND created_by IS NOT NULL
  );

-- ⑫ ai_providers INSERT — 要求 id / name / base_url 必填
ALTER POLICY "ai_providers_public_insert"
  ON public.ai_providers
  WITH CHECK (
    id IS NOT NULL
    AND name IS NOT NULL
    AND base_url IS NOT NULL
  );

-- ⑬ ai_providers UPDATE — USING + WITH CHECK 雙改
ALTER POLICY "ai_providers_public_update"
  ON public.ai_providers
  USING (id IS NOT NULL)
  WITH CHECK (
    id IS NOT NULL
    AND name IS NOT NULL
    AND base_url IS NOT NULL
  );
