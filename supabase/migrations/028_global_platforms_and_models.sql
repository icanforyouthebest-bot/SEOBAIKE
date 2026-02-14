-- ============================================================
-- 全球通訊平台 + AI 模型 全部註冊
-- ============================================================

-- 全球通訊平台
INSERT INTO global_platform_registry (platform_code, display_name, category, integration_status, locked_by) VALUES
('telegram',    'Telegram',           'messaging', 'live',    'founder'),
('perplexity',  'Perplexity AI',      'search',    'live',    'founder'),
('line',        'LINE',               'messaging', 'planned', 'founder'),
('whatsapp',    'WhatsApp',           'messaging', 'planned', 'founder'),
('messenger',   'Facebook Messenger', 'messaging', 'planned', 'founder'),
('wechat',      'WeChat',             'messaging', 'planned', 'founder'),
('kakaotalk',   'KakaoTalk',          'messaging', 'planned', 'founder'),
('viber',       'Viber',              'messaging', 'planned', 'founder'),
('discord',     'Discord',            'messaging', 'planned', 'founder'),
('slack',       'Slack',              'messaging', 'planned', 'founder'),
('instagram',   'Instagram DM',       'messaging', 'planned', 'founder'),
('x',           'X (Twitter) DM',     'messaging', 'planned', 'founder'),
('signal',      'Signal',             'messaging', 'planned', 'founder'),
('imessage',    'iMessage',           'messaging', 'planned', 'founder'),
('zalo',        'Zalo',               'messaging', 'planned', 'founder'),
('google-search','Google Search Console','search',  'beta',    'founder')
ON CONFLICT (platform_code) DO NOTHING;

-- 全球 AI 模型 2026/02 最新
INSERT INTO ai_model_registry (model_id, provider, display_name, tier, version_rank, context_window, is_available, is_default, locked_by) VALUES
('sonar-reasoning-pro',  'perplexity', 'Sonar Reasoning Pro',  'flagship',  95, 128000, true, true,  'founder'),
('sonar-pro',            'perplexity', 'Sonar Pro',            'standard',  85, 200000, true, false, 'founder'),
('sonar',                'perplexity', 'Sonar',                'fast',      75, 128000, true, false, 'founder'),
('claude-opus-4-6',      'anthropic',  'Claude Opus 4.6',      'flagship',  98, 200000, true, false, 'founder'),
('claude-sonnet-4-5',    'anthropic',  'Claude Sonnet 4.5',    'standard',  92, 200000, true, false, 'founder'),
('claude-haiku-4-5',     'anthropic',  'Claude Haiku 4.5',     'fast',      80, 200000, true, false, 'founder'),
('gpt-4.5-preview',     'openai',     'GPT-4.5',              'flagship',  93, 128000, true, false, 'founder'),
('gpt-4o',              'openai',     'GPT-4o',                'standard',  90, 128000, true, false, 'founder'),
('gpt-4o-mini',         'openai',     'GPT-4o Mini',           'fast',      70, 128000, true, false, 'founder'),
('gemini-3-pro',        'google',     'Gemini 3 Pro',          'flagship',  96, 1000000, true, false, 'founder'),
('gemini-3-flash',      'google',     'Gemini 3 Flash',        'fast',      78, 1000000, true, false, 'founder'),
('llama-4-maverick',    'meta',       'Llama 4 Maverick',      'standard',  82, 1000000, true, false, 'founder'),
('llama-4-scout',       'meta',       'Llama 4 Scout',         'fast',      72, 10000000, true, false, 'founder'),
('llama-3.3-70b',       'meta',       'Llama 3.3 70B (CF Free)','standard', 76, 128000, true, false, 'founder'),
('llama-3.1-8b',        'meta',       'Llama 3.1 8B (CF Free)', 'edge',    60, 128000, true, false, 'founder'),
('mistral-large-3',     'mistral',    'Mistral Large 3',       'standard',  77, 128000, true, false, 'founder'),
('deepseek-v3',         'deepseek',   'DeepSeek V3',           'standard',  74, 128000, true, false, 'founder'),
('deepseek-r1',         'deepseek',   'DeepSeek R1',           'flagship',  88, 128000, true, false, 'founder'),
('grok-3',              'xai',        'Grok 3',                'flagship',  91, 128000, true, false, 'founder'),
('grok-3-mini',         'xai',        'Grok 3 Mini',           'fast',      73, 128000, true, false, 'founder')
ON CONFLICT (model_id) DO NOTHING;
