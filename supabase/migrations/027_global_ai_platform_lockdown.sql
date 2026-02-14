-- ============================================================
-- Migration 027: BAIKE 全球 AI 模型 + 平台鎖死
-- 2026/02 品牌上線版本
-- 任何工程師進來都動不了核心設定
-- AI 自動抓最強版本，SQL 層鎖死
-- ============================================================

-- ============================================================
-- 1. AI 模型註冊表（全球可用模型）
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_model_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model_id text NOT NULL,
  display_name text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('flagship', 'standard', 'fast', 'edge')),
  capabilities jsonb DEFAULT '[]',
  context_window int,
  max_output_tokens int,
  cost_per_1m_input numeric,
  cost_per_1m_output numeric,
  release_date date,
  is_available boolean DEFAULT true,
  is_default boolean DEFAULT false,
  version_rank int DEFAULT 0,
  locked_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, model_id)
);

COMMENT ON TABLE ai_model_registry IS 'BAIKE 全球 AI 模型註冊表 — 鎖死級';
COMMENT ON COLUMN ai_model_registry.tier IS 'flagship=旗艦 standard=標準 fast=快速 edge=邊緣';
COMMENT ON COLUMN ai_model_registry.version_rank IS '越高越新越強，強制選最高';

-- ============================================================
-- 2. 全球通訊平台註冊表
-- ============================================================
CREATE TABLE IF NOT EXISTS global_platform_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  region text[] DEFAULT '{}',
  monthly_active_users bigint,
  supports_webhook boolean DEFAULT false,
  supports_buttons boolean DEFAULT false,
  supports_mini_app boolean DEFAULT false,
  supports_voice boolean DEFAULT false,
  supports_image boolean DEFAULT false,
  supports_payment boolean DEFAULT false,
  api_version text,
  integration_status text DEFAULT 'planned' CHECK (integration_status IN ('live', 'beta', 'planned', 'deprecated')),
  priority int DEFAULT 0,
  locked_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE global_platform_registry IS 'BAIKE 全球通訊平台註冊 — 所有工程師只能讀不能改';

-- ============================================================
-- 3. 插入 2026/02 全球 AI 模型
-- ============================================================
INSERT INTO ai_model_registry (provider, model_id, display_name, tier, capabilities, context_window, max_output_tokens, cost_per_1m_input, cost_per_1m_output, release_date, is_available, is_default, version_rank, locked_by) VALUES
-- Anthropic
('anthropic', 'claude-opus-4-6',     'Claude Opus 4.6',   'flagship',  '["text","vision","code","reasoning","multilingual","tool_use"]', 200000, 32000, 15, 75, '2025-10-01', true, true, 100, 'founder'),
('anthropic', 'claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5', 'standard', '["text","vision","code","reasoning","multilingual","tool_use"]', 200000, 16000, 3, 15, '2025-09-29', true, false, 90, 'founder'),
('anthropic', 'claude-haiku-4-5-20251001',  'Claude Haiku 4.5',  'fast',     '["text","vision","code","multilingual","tool_use"]', 200000, 8192, 0.8, 4, '2025-10-01', true, false, 80, 'founder'),
-- OpenAI
('openai', 'gpt-4.5-preview', 'GPT-4.5',     'flagship', '["text","vision","code","reasoning","multilingual","tool_use"]', 128000, 16384, 75, 150, '2025-02-27', true, false, 85, 'system'),
('openai', 'gpt-4o',          'GPT-4o',       'standard', '["text","vision","code","multilingual","tool_use","realtime"]', 128000, 16384, 2.5, 10, '2024-05-13', true, false, 75, 'system'),
('openai', 'gpt-4o-mini',     'GPT-4o Mini',  'fast',     '["text","vision","code","multilingual"]', 128000, 16384, 0.15, 0.6, '2024-07-18', true, false, 60, 'system'),
-- Google
('google', 'gemini-3-pro',    'Gemini 3 Pro',   'flagship', '["text","vision","code","reasoning","multilingual","search","1m_context"]', 1000000, 65536, 7, 21, '2026-01-15', true, false, 95, 'system'),
('google', 'gemini-3-flash',  'Gemini 3 Flash', 'fast',     '["text","vision","code","multilingual","search"]', 1000000, 65536, 0.1, 0.4, '2026-01-15', true, false, 70, 'system'),
-- Meta (Open Source)
('meta', 'llama-4-maverick', 'Llama 4 Maverick', 'standard', '["text","vision","code","multilingual","open_source"]', 1000000, 32000, 0, 0, '2025-04-05', true, false, 72, 'system'),
('meta', 'llama-4-scout',    'Llama 4 Scout',    'fast',     '["text","vision","code","multilingual","open_source","10m_context"]', 10000000, 32000, 0, 0, '2025-04-05', true, false, 68, 'system'),
-- Mistral
('mistral', 'mistral-large-3', 'Mistral Large 3', 'standard', '["text","code","multilingual","open_weight"]', 128000, 16384, 2, 6, '2025-11-01', true, false, 65, 'system'),
-- DeepSeek
('deepseek', 'deepseek-v3', 'DeepSeek V3', 'standard', '["text","code","reasoning","multilingual","open_source"]', 128000, 16384, 0.27, 1.1, '2025-03-01', true, false, 63, 'system')
ON CONFLICT (provider, model_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tier = EXCLUDED.tier,
  capabilities = EXCLUDED.capabilities,
  context_window = EXCLUDED.context_window,
  version_rank = EXCLUDED.version_rank,
  is_available = EXCLUDED.is_available,
  updated_at = now();

-- ============================================================
-- 4. 插入全球通訊平台
-- ============================================================
INSERT INTO global_platform_registry (platform_code, display_name, region, monthly_active_users, supports_webhook, supports_buttons, supports_mini_app, supports_voice, supports_image, supports_payment, api_version, integration_status, priority, locked_by) VALUES
('telegram',   'Telegram',        '{global}',                          950000000,  true, true, true, true, true, true, '8.3', 'live', 100, 'founder'),
('line',       'LINE',            '{JP,TW,TH,ID}',                    196000000,  true, true, true, true, true, true, '3.0', 'live', 95, 'founder'),
('whatsapp',   'WhatsApp',        '{global}',                          2800000000, true, true, false, true, true, true, '21.0', 'live', 90, 'founder'),
('messenger',  'Messenger',       '{global}',                          1000000000, true, true, false, true, true, true, '19.0', 'live', 85, 'founder'),
('wechat',     'WeChat',          '{CN,global_chinese}',               1300000000, true, true, true, true, true, true, '3.0', 'planned', 80, 'system'),
('kakaotalk',  'KakaoTalk',       '{KR}',                              53000000,   true, true, true, true, true, true, '2.0', 'planned', 70, 'system'),
('viber',      'Viber',           '{UA,PH,MM,GR,BG,RS}',              260000000,  true, true, false, true, true, true, '10.0', 'planned', 60, 'system'),
('discord',    'Discord',         '{global}',                          200000000,  true, true, false, true, true, false, '10', 'planned', 55, 'system'),
('slack',      'Slack',           '{global_business}',                  40000000,   true, true, false, true, true, false, '2.0', 'planned', 50, 'system'),
('instagram',  'Instagram DM',    '{global}',                          2000000000, true, true, false, true, true, false, '19.0', 'planned', 45, 'system'),
('x',          'X (Twitter) DM',  '{global}',                          600000000,  true, false, false, false, true, false, '2', 'planned', 40, 'system'),
('signal',     'Signal',          '{global_privacy}',                   70000000,   true, false, false, true, true, false, '1.0', 'planned', 35, 'system'),
('imessage',   'iMessage',        '{US,global_apple}',                 1200000000, false, false, false, true, true, true, 'n/a', 'planned', 30, 'system')
ON CONFLICT (platform_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  monthly_active_users = EXCLUDED.monthly_active_users,
  integration_status = EXCLUDED.integration_status,
  updated_at = now();

-- ============================================================
-- 5. AI 模型路由規則（寫入既有表）
-- ============================================================
INSERT INTO ai_model_routing_config (route_name, provider, model, priority, conditions, fallback_provider, fallback_model, is_enabled, description, rate_limit_per_minute, max_tokens_per_request) VALUES
('default',         'anthropic', 'claude-opus-4-6',          100, '{"task":"*"}',            'google',    'gemini-3-pro',    true, 'BAIKE 預設：Opus 4.6 → Gemini 3 Pro', 60, 32000),
('fast_response',   'anthropic', 'claude-haiku-4-5-20251001', 90, '{"task":"quick_reply"}',   'google',    'gemini-3-flash',  true, '快速回應：Haiku 4.5 → Gemini Flash',    120, 8192),
('code_generation', 'anthropic', 'claude-sonnet-4-5-20250929',85, '{"task":"code"}',          'openai',    'gpt-4.5-preview', true, '程式碼：Sonnet 4.5 → GPT-4.5',         60, 16000),
('seo_analysis',    'anthropic', 'claude-opus-4-6',          100, '{"task":"seo"}',           'google',    'gemini-3-pro',    true, 'SEO 分析：旗艦級 Opus 4.6',            30, 32000),
('multilingual',    'google',    'gemini-3-pro',              95, '{"task":"translation"}',   'anthropic', 'claude-opus-4-6', true, '多語系：Gemini 3 Pro 1M context',      60, 65536),
('budget_batch',    'deepseek',  'deepseek-v3',               50, '{"task":"batch","budget":"low"}', 'meta', 'llama-4-maverick', true, '低成本批次：DeepSeek V3 → Llama 4', 120, 16384)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. 強制選最強模型的函數
-- ============================================================
CREATE OR REPLACE FUNCTION get_best_model(
  p_task text DEFAULT '*',
  p_tier text DEFAULT 'flagship'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_model record;
  v_route record;
BEGIN
  -- 先查路由規則
  SELECT * INTO v_route
    FROM ai_model_routing_config
    WHERE is_enabled = true
      AND (conditions->>'task' = p_task OR conditions->>'task' = '*')
    ORDER BY priority DESC
    LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'provider', v_route.provider,
      'model', v_route.model,
      'fallback_provider', v_route.fallback_provider,
      'fallback_model', v_route.fallback_model,
      'route', v_route.route_name,
      'max_tokens', v_route.max_tokens_per_request
    );
  END IF;

  -- 沒有路由規則就選 version_rank 最高的
  SELECT * INTO v_model
    FROM ai_model_registry
    WHERE is_available = true
      AND (tier = p_tier OR p_tier = '*')
    ORDER BY version_rank DESC
    LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'provider', v_model.provider,
      'model', v_model.model_id,
      'fallback_provider', null,
      'fallback_model', null,
      'route', 'auto_best',
      'max_tokens', v_model.max_output_tokens
    );
  END IF;

  -- 最終兜底
  RETURN jsonb_build_object(
    'provider', 'anthropic',
    'model', 'claude-opus-4-6',
    'route', 'hardcoded_fallback'
  );
END;
$$;

COMMENT ON FUNCTION get_best_model(text, text) IS '強制取最強可用模型 — version_rank 排序，永遠選最高';

-- ============================================================
-- 7. 版本強制更新函數
-- ============================================================
CREATE OR REPLACE FUNCTION register_new_model(
  p_provider text,
  p_model_id text,
  p_display_name text,
  p_tier text,
  p_capabilities jsonb,
  p_context_window int,
  p_version_rank int,
  p_set_default boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_old_default record;
BEGIN
  INSERT INTO ai_model_registry (provider, model_id, display_name, tier, capabilities, context_window, version_rank, is_available, is_default, locked_by)
  VALUES (p_provider, p_model_id, p_display_name, p_tier, p_capabilities, p_context_window, p_version_rank, true, p_set_default, 'ai_auto_update')
  ON CONFLICT (provider, model_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    tier = EXCLUDED.tier,
    capabilities = EXCLUDED.capabilities,
    context_window = EXCLUDED.context_window,
    version_rank = EXCLUDED.version_rank,
    is_available = true,
    updated_at = now();

  -- 如果設為預設，取消舊的預設
  IF p_set_default THEN
    UPDATE ai_model_registry SET is_default = false
      WHERE model_id != p_model_id AND is_default = true;
    UPDATE ai_model_registry SET is_default = true
      WHERE model_id = p_model_id;

    -- 同步更新路由表的 default 路由
    UPDATE ai_model_routing_config SET
      provider = p_provider,
      model = p_model_id,
      updated_at = now()
    WHERE route_name = 'default';
  END IF;

  INSERT INTO remote_command_logs (event_type, details)
  VALUES ('model_registered', jsonb_build_object(
    'provider', p_provider,
    'model', p_model_id,
    'version_rank', p_version_rank,
    'set_as_default', p_set_default
  ));

  RETURN jsonb_build_object(
    'success', true,
    'message', p_display_name || ' registered. Rank: ' || p_version_rank
  );
END;
$$;

COMMENT ON FUNCTION register_new_model IS 'AI 自動註冊新模型 — 版本更強自動升級';

-- ============================================================
-- 8. RLS + Trigger 鎖死：只有 founder 能改核心表
-- ============================================================
ALTER TABLE ai_model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_platform_registry ENABLE ROW LEVEL SECURITY;

-- 所有人可讀
CREATE POLICY ai_model_registry_read ON ai_model_registry
  FOR SELECT USING (true);
CREATE POLICY global_platform_registry_read ON global_platform_registry
  FOR SELECT USING (true);

-- 只有 service_role 可寫（透過 SECURITY DEFINER 函數）
CREATE POLICY ai_model_registry_write ON ai_model_registry
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY global_platform_registry_write ON global_platform_registry
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- HARD LOCK: 工程師防呆 — 只能升級不能降級
-- 老闆搭飛機，不准叫老闆騎腳踏車
-- ============================================================

-- A. founder 鎖定的紀錄完全不可動
CREATE OR REPLACE FUNCTION protect_founder_lock()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.locked_by = 'founder' THEN
    RAISE EXCEPTION 'FOUNDER LOCK: 創辦人鎖定的紀錄不可修改。聯繫創辦人解鎖。';
  END IF;
  RETURN NEW;
END;
$$;

-- B. AI 模型：不准降級、不准關掉旗艦、不准把預設換成弱的
CREATE OR REPLACE FUNCTION enforce_model_upgrade_only()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- 規則 1：不准降級 version_rank
  IF NEW.version_rank < OLD.version_rank THEN
    RAISE EXCEPTION 'DOWNGRADE BLOCKED: version_rank 只能升不能降。現在 % → 你要 %。不准。', OLD.version_rank, NEW.version_rank;
  END IF;

  -- 規則 2：旗艦模型不准關掉
  IF OLD.tier = 'flagship' AND OLD.is_available = true AND NEW.is_available = false THEN
    RAISE EXCEPTION 'FLAGSHIP PROTECTED: 旗艦模型 % 不可停用。', OLD.display_name;
  END IF;

  -- 規則 3：預設模型不准被取消預設（除非同時有另一個更強的被設為預設）
  IF OLD.is_default = true AND NEW.is_default = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM ai_model_registry
      WHERE is_default = true AND model_id != OLD.model_id AND version_rank >= OLD.version_rank
    ) THEN
      RAISE EXCEPTION 'DEFAULT PROTECTED: 預設模型不可取消，除非有更強的替代。';
    END IF;
  END IF;

  -- 規則 4：新預設必須是旗艦級且 rank >= 90
  IF NEW.is_default = true AND OLD.is_default = false THEN
    IF NEW.tier != 'flagship' THEN
      RAISE EXCEPTION 'DEFAULT MUST BE FLAGSHIP: 預設模型必須是旗艦級。% 是 %。', NEW.display_name, NEW.tier;
    END IF;
    IF NEW.version_rank < 90 THEN
      RAISE EXCEPTION 'DEFAULT RANK TOO LOW: 預設模型 version_rank 必須 >= 90。% 只有 %。', NEW.display_name, NEW.version_rank;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- C. 路由規則：不准把主路由換成弱模型
CREATE OR REPLACE FUNCTION enforce_routing_quality()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_new_rank int;
  v_old_rank int;
BEGIN
  -- 查新模型的 rank
  SELECT version_rank INTO v_new_rank
    FROM ai_model_registry WHERE provider = NEW.provider AND model_id = NEW.model;
  SELECT version_rank INTO v_old_rank
    FROM ai_model_registry WHERE provider = OLD.provider AND model_id = OLD.model;

  -- 主路由（priority >= 90）不准換成更弱的
  IF OLD.priority >= 90 AND v_new_rank IS NOT NULL AND v_old_rank IS NOT NULL THEN
    IF v_new_rank < v_old_rank THEN
      RAISE EXCEPTION 'ROUTING DOWNGRADE BLOCKED: 主路由 % 不可從 rank % 降到 %。只能升級。', OLD.route_name, v_old_rank, v_new_rank;
    END IF;
  END IF;

  -- 不准把主路由降級 priority
  IF NEW.priority < OLD.priority AND OLD.priority >= 90 THEN
    RAISE EXCEPTION 'PRIORITY DOWNGRADE BLOCKED: 主路由 % 的 priority 不可降低。', OLD.route_name;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- D. 平台註冊：live 的不准降級成 planned
CREATE OR REPLACE FUNCTION enforce_platform_no_downgrade()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_status_order jsonb := '{"live":4,"beta":3,"planned":2,"deprecated":1}'::jsonb;
BEGIN
  IF (v_status_order->>NEW.integration_status)::int < (v_status_order->>OLD.integration_status)::int THEN
    IF OLD.locked_by = 'founder' THEN
      RAISE EXCEPTION 'PLATFORM DOWNGRADE BLOCKED: % 是 founder 鎖定的 % 狀態，不可降為 %。', OLD.display_name, OLD.integration_status, NEW.integration_status;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 掛上所有 Trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_protect_ai_model_founder ON ai_model_registry;
CREATE TRIGGER trg_protect_ai_model_founder
  BEFORE UPDATE ON ai_model_registry
  FOR EACH ROW EXECUTE FUNCTION protect_founder_lock();

DROP TRIGGER IF EXISTS trg_enforce_model_upgrade ON ai_model_registry;
CREATE TRIGGER trg_enforce_model_upgrade
  BEFORE UPDATE ON ai_model_registry
  FOR EACH ROW EXECUTE FUNCTION enforce_model_upgrade_only();

DROP TRIGGER IF EXISTS trg_protect_platform_founder ON global_platform_registry;
CREATE TRIGGER trg_protect_platform_founder
  BEFORE UPDATE ON global_platform_registry
  FOR EACH ROW EXECUTE FUNCTION protect_founder_lock();

DROP TRIGGER IF EXISTS trg_enforce_platform_no_downgrade ON global_platform_registry;
CREATE TRIGGER trg_enforce_platform_no_downgrade
  BEFORE UPDATE ON global_platform_registry
  FOR EACH ROW EXECUTE FUNCTION enforce_platform_no_downgrade();

DROP TRIGGER IF EXISTS trg_enforce_routing_quality ON ai_model_routing_config;
CREATE TRIGGER trg_enforce_routing_quality
  BEFORE UPDATE ON ai_model_routing_config
  FOR EACH ROW EXECUTE FUNCTION enforce_routing_quality();

-- 刪除也鎖死：founder 的紀錄不可刪
CREATE OR REPLACE FUNCTION block_founder_delete()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.locked_by = 'founder' THEN
    RAISE EXCEPTION 'FOUNDER LOCK: 創辦人鎖定的紀錄不可刪除。';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_model_delete ON ai_model_registry;
CREATE TRIGGER trg_block_model_delete
  BEFORE DELETE ON ai_model_registry
  FOR EACH ROW EXECUTE FUNCTION block_founder_delete();

DROP TRIGGER IF EXISTS trg_block_platform_delete ON global_platform_registry;
CREATE TRIGGER trg_block_platform_delete
  BEFORE DELETE ON global_platform_registry
  FOR EACH ROW EXECUTE FUNCTION block_founder_delete();

-- ============================================================
-- 9. 查詢函數：目前使用中的配置
-- ============================================================
CREATE OR REPLACE FUNCTION get_baike_config()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_default_model record;
  v_platforms jsonb;
  v_model_count int;
  v_platform_count int;
  v_live_platforms int;
BEGIN
  SELECT * INTO v_default_model FROM ai_model_registry WHERE is_default = true LIMIT 1;
  SELECT count(*) INTO v_model_count FROM ai_model_registry WHERE is_available = true;
  SELECT count(*) INTO v_platform_count FROM global_platform_registry;
  SELECT count(*) INTO v_live_platforms FROM global_platform_registry WHERE integration_status = 'live';

  SELECT jsonb_agg(jsonb_build_object(
    'platform', platform_code,
    'name', display_name,
    'status', integration_status,
    'users', monthly_active_users
  ) ORDER BY priority DESC) INTO v_platforms
  FROM global_platform_registry;

  RETURN jsonb_build_object(
    'brand', 'BAIKE',
    'version', '2.0.0',
    'launch_date', '2026-02',
    'default_ai', jsonb_build_object(
      'provider', v_default_model.provider,
      'model', v_default_model.model_id,
      'display_name', v_default_model.display_name,
      'tier', v_default_model.tier,
      'version_rank', v_default_model.version_rank
    ),
    'ai_models_available', v_model_count,
    'platforms_total', v_platform_count,
    'platforms_live', v_live_platforms,
    'platforms', v_platforms
  );
END;
$$;

COMMENT ON FUNCTION get_baike_config() IS 'BAIKE 全域配置查詢 — 品牌/AI模型/平台一覽';
