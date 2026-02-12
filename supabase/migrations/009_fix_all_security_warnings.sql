-- ============================================
-- Migration 009: Fix all security warnings
-- 12 of 13 WARNs fixed via SQL
-- (13th = Auth leaked password protection → Dashboard setting)
-- Migration: 20260211185512_fix_all_security_warnings
-- ============================================

-- ============================================
-- 1. Move pg_trgm from public → extensions schema
-- ============================================
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ============================================
-- 2. Lock search_path on all 10 flagged functions
-- ============================================

-- 2.1 log_event
ALTER FUNCTION public.log_event(text, text, text, jsonb, text)
  SET search_path = 'public';

-- 2.2 complete_ai_task
ALTER FUNCTION public.complete_ai_task(uuid, jsonb)
  SET search_path = 'public';

-- 2.3 enqueue_ai_task
ALTER FUNCTION public.enqueue_ai_task(text, text, jsonb, integer, timestamptz)
  SET search_path = 'public';

-- 2.4 db_now_and_version
ALTER FUNCTION public.db_now_and_version()
  SET search_path = 'public';

-- 2.5 list_extensions_sample
ALTER FUNCTION public.list_extensions_sample()
  SET search_path = 'public';

-- 2.6 list_rls_sample
ALTER FUNCTION public.list_rls_sample()
  SET search_path = 'public';

-- 2.7 generate_device_fingerprint (uses pgcrypto.digest in extensions schema)
ALTER FUNCTION public.generate_device_fingerprint(text, text, text)
  SET search_path = 'public, extensions';

-- 2.8 log_voice_command
ALTER FUNCTION public.log_voice_command(uuid, text, numeric, text, text, text, text, text, text)
  SET search_path = 'public';

-- 2.9 handle_new_user
ALTER FUNCTION public.handle_new_user()
  SET search_path = 'public';

-- 2.10 has_role(uuid, app_role) — the (uuid, text) overload already has search_path set
ALTER FUNCTION public.has_role(uuid, app_role)
  SET search_path = 'public';

-- ============================================
-- 3. Fix frozen_snapshots INSERT policy
--    Change from WITH CHECK (true) → require authenticated user
--    service_role bypasses RLS entirely, so it can still INSERT
-- ============================================
DROP POLICY frozen_snapshots_insert ON public.frozen_snapshots;
CREATE POLICY frozen_snapshots_insert ON public.frozen_snapshots
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
