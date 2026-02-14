-- ============================================================
-- Migration 026: platform_tokens 多租戶 Bot Token 儲存
-- 未來幾百萬老闆，每個人綁自己的 Bot
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  platform text NOT NULL CHECK (platform IN ('telegram','line','whatsapp','messenger')),
  token_key text NOT NULL,
  token_value text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, platform, token_key)
);

COMMENT ON TABLE platform_tokens IS '各平台 Bot Token 儲存（多租戶，每個老闆綁自己的 Bot）';
COMMENT ON COLUMN platform_tokens.owner_id IS '擁有者 user_id，NULL = 系統全域 token';
COMMENT ON COLUMN platform_tokens.token_key IS 'bot_token / channel_secret / access_token / verify_token 等';
COMMENT ON COLUMN platform_tokens.token_value IS '實際 token 值';

-- ============================================================
-- 讀取 token 的函數（Worker 呼叫用）
-- 先找 owner 專屬，找不到用系統全域
-- ============================================================
CREATE OR REPLACE FUNCTION get_platform_token(
  p_platform text,
  p_token_key text,
  p_owner_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_token text;
BEGIN
  IF p_owner_id IS NOT NULL THEN
    SELECT token_value INTO v_token
      FROM platform_tokens
      WHERE platform = p_platform
        AND token_key = p_token_key
        AND owner_id = p_owner_id
        AND is_active = true
      LIMIT 1;
  END IF;

  IF v_token IS NULL THEN
    SELECT token_value INTO v_token
      FROM platform_tokens
      WHERE platform = p_platform
        AND token_key = p_token_key
        AND owner_id IS NULL
        AND is_active = true
      LIMIT 1;
  END IF;

  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION get_platform_token(text, text, uuid) IS '讀取平台 token：先找用戶專屬，找不到用系統全域';

-- ============================================================
-- 綁定 token 函數
-- ============================================================
CREATE OR REPLACE FUNCTION handle_bind_token(
  p_user_id uuid,
  p_platform text,
  p_token_key text,
  p_token_value text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO platform_tokens (owner_id, platform, token_key, token_value)
  VALUES (p_user_id, p_platform, p_token_key, p_token_value)
  ON CONFLICT (owner_id, platform, token_key)
  DO UPDATE SET token_value = EXCLUDED.token_value, updated_at = now(), is_active = true;

  INSERT INTO remote_command_logs (event_type, details)
  VALUES ('token_bound', jsonb_build_object(
    'user_id', p_user_id,
    'platform', p_platform,
    'token_key', p_token_key
  ));

  RETURN jsonb_build_object(
    'success', true,
    'message', p_platform || ' ' || p_token_key || ' 綁定成功！'
  );
END;
$$;

COMMENT ON FUNCTION handle_bind_token(uuid, text, text, text) IS '綁定平台 token — /bind telegram bot_token xxx';

-- RLS：只有 service_role 能讀寫
ALTER TABLE platform_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_tokens_service_only ON platform_tokens
  FOR ALL USING (auth.role() = 'service_role');
