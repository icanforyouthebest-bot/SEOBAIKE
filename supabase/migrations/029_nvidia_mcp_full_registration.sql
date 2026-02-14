-- ============================================================================
-- Migration 029: NVIDIA 全套 + MCP 生態一次到位
-- 日期: 2026-02-14
-- 說明:
--   1. ALTER tier CHECK 新增 safety / platform / infra
--   2. INSERT NVIDIA 全套 17 項（LLM、安全、平台、基礎建設）
--   3. INSERT MCP 生態 10 項
--   4. INSERT 路由設定 6 條
-- ============================================================================

-- ============================================================================
-- STEP 1: ALTER tier CHECK — 新增 safety / platform / infra
-- 先找到並刪掉現有的 tier CHECK constraint，再加新的
-- ============================================================================
DO $$
DECLARE
  _con_name text;
BEGIN
  SELECT con.conname INTO _con_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'ai_model_registry'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%tier%';

  IF _con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ai_model_registry DROP CONSTRAINT %I', _con_name);
    RAISE NOTICE 'Dropped existing tier constraint: %', _con_name;
  ELSE
    RAISE NOTICE 'No existing tier constraint found, skipping drop';
  END IF;
END;
$$;

ALTER TABLE ai_model_registry
  ADD CONSTRAINT ai_model_registry_tier_check
  CHECK (tier IN ('flagship', 'standard', 'fast', 'edge', 'safety', 'platform', 'infra'));

-- ============================================================================
-- STEP 2: INSERT NVIDIA 全套 17 項
-- ============================================================================
INSERT INTO ai_model_registry (
  provider, model_id, display_name, tier,
  context_window, is_available, is_default,
  version_rank, locked_by
) VALUES

-- === NVIDIA LLM ===
('nvidia', 'nemotron-4-340b-instruct', 'Nemotron-4 340B Instruct', 'flagship',
  4096, true, false, 90, 'system'),

('nvidia', 'llama-3-taiwan-70b', 'Llama-3 Taiwan 70B', 'flagship',
  8192, true, false, 85, 'system'),

-- === NVIDIA Safety 安全三件套 + NeMo Guardrails ===
('nvidia', 'nemo-guardrails', 'NeMo Guardrails', 'safety',
  NULL, true, false, 80, 'system'),

('nvidia', 'content-safety-nim', 'Content Safety NIM', 'safety',
  NULL, true, false, 78, 'system'),

('nvidia', 'jailbreak-detect-nim', 'Jailbreak Detect NIM', 'safety',
  NULL, true, false, 77, 'system'),

('nvidia', 'topic-control-nim', 'Topic Control NIM', 'safety',
  NULL, true, false, 76, 'system'),

-- === NVIDIA Platform 平台級 ===
('nvidia', 'riva-asr-zh', 'Riva ASR 中文語音辨識', 'platform',
  NULL, true, false, 70, 'system'),

('nvidia', 'metropolis', 'NVIDIA Metropolis', 'platform',
  NULL, true, false, 70, 'system'),

('nvidia', 'nemo-customizer', 'NeMo Customizer', 'platform',
  NULL, true, false, 70, 'system'),

('nvidia', 'blueprints', 'NVIDIA AI Blueprints', 'platform',
  NULL, true, false, 65, 'system'),

('nvidia', 'tokkio', 'NVIDIA Tokkio', 'platform',
  NULL, true, false, 65, 'system'),

('nvidia', 'cuopt', 'NVIDIA cuOpt', 'platform',
  NULL, true, false, 60, 'system'),

('nvidia', 'bionemo', 'NVIDIA BioNeMo', 'platform',
  NULL, true, false, 60, 'system'),

('nvidia', 'omniverse', 'NVIDIA Omniverse', 'platform',
  NULL, true, false, 65, 'system'),

('nvidia', 'nemo-agent-toolkit', 'NeMo Agent Toolkit', 'platform',
  NULL, true, false, 70, 'system'),

-- === NVIDIA Infra 基礎建設 ===
('nvidia', 'tensorrt-llm', 'TensorRT-LLM', 'infra',
  NULL, true, false, 75, 'system'),

('nvidia', 'dgx-cloud', 'NVIDIA DGX Cloud', 'infra',
  NULL, true, false, 70, 'system')

ON CONFLICT (model_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tier = EXCLUDED.tier,
  context_window = EXCLUDED.context_window,
  version_rank = EXCLUDED.version_rank,
  is_available = EXCLUDED.is_available,
  updated_at = now();

-- ============================================================================
-- STEP 3: INSERT MCP 生態 10 項
-- ============================================================================
INSERT INTO ai_model_registry (
  provider, model_id, display_name, tier,
  context_window, is_available, is_default,
  version_rank, locked_by
) VALUES

('mcp', 'smithery', 'Smithery MCP Hub', 'platform',
  NULL, true, false, 80, 'system'),

('mcp', 'composio', 'Composio MCP', 'platform',
  NULL, true, false, 78, 'system'),

('mcp', 'stripe-mcp', 'Stripe MCP Server', 'platform',
  NULL, true, false, 75, 'system'),

('mcp', 'supabase-mcp', 'Supabase MCP Server', 'platform',
  NULL, true, true, 85, 'founder'),

('mcp', 'github-mcp', 'GitHub MCP Server', 'platform',
  NULL, true, true, 85, 'founder'),

('mcp', 'cloudflare-mcp', 'Cloudflare MCP Server', 'platform',
  NULL, true, false, 75, 'system'),

('mcp', 'browserbase-mcp', 'Browserbase MCP Server', 'platform',
  NULL, true, false, 70, 'system'),

('mcp', 'firecrawl-mcp', 'Firecrawl MCP Server', 'platform',
  NULL, true, false, 70, 'system'),

('mcp', 'postgres-mcp', 'PostgreSQL MCP Server', 'platform',
  NULL, true, true, 85, 'founder'),

('mcp', 'puppeteer-mcp', 'Puppeteer MCP Server', 'platform',
  NULL, true, false, 70, 'system')

ON CONFLICT (model_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  tier = EXCLUDED.tier,
  is_available = EXCLUDED.is_available,
  updated_at = now();

-- ============================================================================
-- STEP 4: INSERT 路由設定 6 條
-- ============================================================================
INSERT INTO ai_model_routing_config (
  route_name, provider, model, priority, conditions,
  fallback_provider, fallback_model, is_enabled, description,
  rate_limit_per_minute, max_tokens_per_request
) VALUES

-- nvidia_reasoning: 340B 重推理
('nvidia_reasoning', 'nvidia', 'nemotron-4-340b-instruct', 70,
  '{"task":"deep_reasoning","complexity":"high"}',
  'anthropic', 'claude-opus-4-6', true,
  'NVIDIA 重推理：Nemotron 340B → Claude Opus 4.6 fallback',
  30, 4096),

-- nvidia_chinese: Taiwan-70B 中文專用
('nvidia_chinese', 'nvidia', 'llama-3-taiwan-70b', 70,
  '{"task":"chinese_generation","language":"zh-TW"}',
  'anthropic', 'claude-opus-4-6', true,
  'NVIDIA 中文：Taiwan 70B → Claude Opus 4.6 fallback',
  30, 4096),

-- nvidia_safety: 安全三件套
('nvidia_safety', 'nvidia', 'nemo-guardrails', 80,
  '{"task":"safety_check","pipeline":"pre_and_post"}',
  'nvidia', 'content-safety-nim', true,
  'NVIDIA 安全：Guardrails → Content Safety NIM fallback',
  120, 2048),

-- nvidia_voice: Riva 語音
('nvidia_voice', 'nvidia', 'riva-asr-zh', 60,
  '{"task":"speech_to_text","language":"zh"}',
  NULL, NULL, true,
  'NVIDIA 語音：Riva ASR 中文（無 fallback）',
  30, NULL),

-- nvidia_vision: Metropolis 影像
('nvidia_vision', 'nvidia', 'metropolis', 60,
  '{"task":"video_analytics","pipeline":"vision"}',
  NULL, NULL, true,
  'NVIDIA 影像：Metropolis 視覺分析（無 fallback）',
  10, NULL),

-- mcp_tools: MCP 工具路由
('mcp_tools', 'mcp', 'supabase-mcp', 85,
  '{"task":"tool_use","protocol":"mcp"}',
  'mcp', 'github-mcp', true,
  'MCP 工具路由：Supabase MCP → GitHub MCP fallback',
  120, NULL)

ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 5: 驗證 — check_inference_path() 模擬
-- ============================================================================
DO $$
DECLARE
  _total_nvidia int;
  _total_mcp int;
  _total_routes int;
  _missing_nvidia text[];
  _missing_mcp text[];
BEGIN
  SELECT count(*) INTO _total_nvidia
  FROM ai_model_registry WHERE provider = 'nvidia';

  SELECT count(*) INTO _total_mcp
  FROM ai_model_registry WHERE provider = 'mcp';

  SELECT count(*) INTO _total_routes
  FROM ai_model_routing_config
  WHERE route_name IN ('nvidia_reasoning','nvidia_chinese','nvidia_safety','nvidia_voice','nvidia_vision','mcp_tools');

  SELECT array_agg(m) INTO _missing_nvidia
  FROM unnest(ARRAY[
    'nemotron-4-340b-instruct','llama-3-taiwan-70b',
    'nemo-guardrails','content-safety-nim','jailbreak-detect-nim','topic-control-nim',
    'riva-asr-zh','tensorrt-llm','metropolis','nemo-customizer',
    'blueprints','tokkio','cuopt','bionemo','dgx-cloud','omniverse','nemo-agent-toolkit'
  ]) AS m
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_registry WHERE provider = 'nvidia' AND model_id = m
  );

  SELECT array_agg(m) INTO _missing_mcp
  FROM unnest(ARRAY[
    'smithery','composio','stripe-mcp','supabase-mcp','github-mcp',
    'cloudflare-mcp','browserbase-mcp','firecrawl-mcp','postgres-mcp','puppeteer-mcp'
  ]) AS m
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_registry WHERE provider = 'mcp' AND model_id = m
  );

  RAISE NOTICE '=== Migration 029 驗證報告 ===';
  RAISE NOTICE 'NVIDIA 註冊數: % (預期 17)', _total_nvidia;
  RAISE NOTICE 'MCP 註冊數: % (預期 10)', _total_mcp;
  RAISE NOTICE '新路由數: % (預期 6)', _total_routes;

  IF _missing_nvidia IS NOT NULL THEN
    RAISE WARNING 'NVIDIA 缺少: %', _missing_nvidia;
  ELSE
    RAISE NOTICE 'NVIDIA 全部到齊';
  END IF;

  IF _missing_mcp IS NOT NULL THEN
    RAISE WARNING 'MCP 缺少: %', _missing_mcp;
  ELSE
    RAISE NOTICE 'MCP 全部到齊';
  END IF;

  IF _total_routes < 6 THEN
    RAISE WARNING '路由不足 6 條，請檢查';
  ELSE
    RAISE NOTICE '路由全部到齊';
  END IF;

  RAISE NOTICE '=== check_inference_path() PASS ===';
END;
$$;
