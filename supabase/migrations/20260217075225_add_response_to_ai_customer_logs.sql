-- 新增 response 欄位，儲存 provider 路由資訊 (provider, model, latencyMs)
ALTER TABLE public.ai_customer_logs
  ADD COLUMN IF NOT EXISTS response jsonb DEFAULT NULL;

COMMENT ON COLUMN public.ai_customer_logs.response IS 'AI provider 路由資訊：{ provider, model, latencyMs }';
