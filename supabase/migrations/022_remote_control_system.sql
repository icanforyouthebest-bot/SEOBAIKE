-- ============================================================
-- Migration 022: 萬能遙控器系統（Remote Control System）
-- 功能：通訊軟體（LINE/Telegram/WhatsApp/Messenger）遠端操控平台
-- ============================================================

-- 1. 通訊軟體帳號綁定表
CREATE TABLE IF NOT EXISTS remote_command_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('line','telegram','whatsapp','messenger','web')),
  platform_user_id text NOT NULL,
  display_name text,
  permission_level text NOT NULL DEFAULT 'user' CHECK (permission_level IN ('founder','boss','user')),
  is_verified boolean NOT NULL DEFAULT false,
  verification_code text,
  verification_expires_at timestamptz,
  bound_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, platform_user_id)
);

COMMENT ON TABLE remote_command_bindings IS '通訊軟體帳號與平台用戶綁定表';

-- 2. 指令定義註冊表
CREATE TABLE IF NOT EXISTS remote_command_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command text NOT NULL UNIQUE,
  category text NOT NULL,
  description_zh text NOT NULL,
  description_en text,
  min_permission text NOT NULL DEFAULT 'user' CHECK (min_permission IN ('founder','boss','user')),
  edge_function text NOT NULL DEFAULT 'remote-command',
  handler text NOT NULL,
  requires_confirmation boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  cooldown_seconds integer NOT NULL DEFAULT 0,
  usage_example text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE remote_command_templates IS '遙控器指令定義與權限對照表';

-- 3. 擴充 remote_commands 表
ALTER TABLE remote_commands
  ADD COLUMN IF NOT EXISTS binding_id uuid REFERENCES remote_command_bindings(id),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS raw_text text,
  ADD COLUMN IF NOT EXISTS parsed_command text,
  ADD COLUMN IF NOT EXISTS parsed_args jsonb,
  ADD COLUMN IF NOT EXISTS permission_level text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS inference_check_id uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reply_text text,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

-- 4. 指令執行日誌表（高頻寫入，獨立於 audit_logs）
CREATE TABLE IF NOT EXISTS remote_command_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid REFERENCES remote_commands(id),
  binding_id uuid REFERENCES remote_command_bindings(id),
  event_type text NOT NULL CHECK (event_type IN (
    'received','parsed','auth_checked','permission_denied',
    'inference_checked','executing','completed','failed',
    'confirmation_requested','confirmation_received','timeout'
  )),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE remote_command_logs IS '指令執行詳細事件日誌';

-- 5. 待確認操作暫存表
CREATE TABLE IF NOT EXISTS remote_command_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  binding_id uuid NOT NULL REFERENCES remote_command_bindings(id),
  command text NOT NULL,
  args jsonb,
  confirmation_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  is_confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE remote_command_confirmations IS '高風險操作二次確認暫存';

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_rcb_user_id ON remote_command_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_rcb_platform_lookup ON remote_command_bindings(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_rcb_permission ON remote_command_bindings(permission_level);

CREATE INDEX IF NOT EXISTS idx_rct_command ON remote_command_templates(command);
CREATE INDEX IF NOT EXISTS idx_rct_category ON remote_command_templates(category);
CREATE INDEX IF NOT EXISTS idx_rct_permission ON remote_command_templates(min_permission);

CREATE INDEX IF NOT EXISTS idx_rc_binding ON remote_commands(binding_id);
CREATE INDEX IF NOT EXISTS idx_rc_parsed_command ON remote_commands(parsed_command);
CREATE INDEX IF NOT EXISTS idx_rc_status ON remote_commands(status);
CREATE INDEX IF NOT EXISTS idx_rc_created ON remote_commands(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rcl_command ON remote_command_logs(command_id);
CREATE INDEX IF NOT EXISTS idx_rcl_created ON remote_command_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rcc_binding ON remote_command_confirmations(binding_id);
CREATE INDEX IF NOT EXISTS idx_rcc_code ON remote_command_confirmations(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_rcc_expires ON remote_command_confirmations(expires_at) WHERE is_confirmed = false;

-- ============================================================
-- Triggers
-- ============================================================

CREATE TRIGGER update_remote_command_bindings_updated_at
  BEFORE UPDATE ON remote_command_bindings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_remote_command_templates_updated_at
  BEFORE UPDATE ON remote_command_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE remote_command_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_command_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_command_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_command_confirmations ENABLE ROW LEVEL SECURITY;

-- remote_command_bindings: 用戶可看自己的，service_role 全權
CREATE POLICY "rcb_select_own" ON remote_command_bindings
  FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "rcb_insert_service" ON remote_command_bindings
  FOR INSERT WITH CHECK (true);
CREATE POLICY "rcb_update_service" ON remote_command_bindings
  FOR UPDATE USING (true);
CREATE POLICY "rcb_delete_service" ON remote_command_bindings
  FOR DELETE USING (true);

-- remote_command_templates: 所有人可讀，service_role 可寫
CREATE POLICY "rct_select_public" ON remote_command_templates
  FOR SELECT USING (true);
CREATE POLICY "rct_insert_service" ON remote_command_templates
  FOR INSERT WITH CHECK (true);
CREATE POLICY "rct_update_service" ON remote_command_templates
  FOR UPDATE USING (true);
CREATE POLICY "rct_delete_service" ON remote_command_templates
  FOR DELETE USING (true);

-- remote_command_logs: service_role 全權
CREATE POLICY "rcl_select_service" ON remote_command_logs
  FOR SELECT USING (true);
CREATE POLICY "rcl_insert_service" ON remote_command_logs
  FOR INSERT WITH CHECK (true);

-- remote_command_confirmations: 用戶可看自己的
CREATE POLICY "rcc_select_own" ON remote_command_confirmations
  FOR SELECT USING (binding_id IN (
    SELECT id FROM remote_command_bindings WHERE user_id = (select auth.uid())
  ));
CREATE POLICY "rcc_insert_service" ON remote_command_confirmations
  FOR INSERT WITH CHECK (true);
CREATE POLICY "rcc_update_service" ON remote_command_confirmations
  FOR UPDATE USING (true);

-- ============================================================
-- Seed: 指令定義
-- ============================================================

INSERT INTO remote_command_templates (command, category, description_zh, min_permission, handler, requires_confirmation, cooldown_seconds, usage_example) VALUES
-- 系統控制
('/status',      'system',     '查看系統狀態',           'boss',    'system-handler',     false, 5,  '/status'),
('/lock',        'system',     '鎖定全系統（唯讀模式）',   'founder', 'system-handler',     true,  0,  '/lock'),
('/unlock',      'system',     '解鎖系統',               'founder', 'system-handler',     true,  0,  '/unlock'),
('/maintenance', 'system',     '切換維護模式',            'founder', 'system-handler',     true,  0,  '/maintenance on'),

-- 功能開關
('/feature',     'feature',    '管理功能開關',            'boss',    'feature-handler',    false, 3,  '/feature list 或 /feature ai_secretary off'),

-- AI 路由
('/ai',          'ai',         '管理 AI 模型配置',        'boss',    'ai-handler',         false, 3,  '/ai list 或 /ai switch chat_general gpt-4o'),
('/ai cost',     'ai',         '查看 AI API 用量統計',    'boss',    'ai-handler',         false, 10, '/ai cost'),

-- 用戶管理
('/users',       'user',       '用戶管理',               'boss',    'user-handler',       false, 5,  '/users count 或 /users ban [id]'),
('/kyc',         'user',       '查看 KYC 狀態',          'boss',    'user-handler',       false, 5,  '/kyc status [user_id]'),

-- 金流
('/revenue',     'payment',    '查看營收統計',            'boss',    'payment-handler',    false, 10, '/revenue today 或 /revenue month'),
('/refund',      'payment',    '執行退款',               'boss',    'payment-handler',    true,  0,  '/refund [order_id]'),
('/points',      'payment',    '點數操作',               'user',    'payment-handler',    false, 5,  '/points 或 /points grant [user] [amount]'),

-- SEO
('/seo',         'seo',        'SEO 分析與報告',          'user',    'seo-handler',        false, 30, '/seo scan [domain] 或 /seo report [domain]'),
('/keywords',    'seo',        '關鍵字排名查詢',          'user',    'seo-handler',        false, 10, '/keywords [domain]'),

-- 合規
('/aml',         'compliance', 'AML 警報查詢',           'founder', 'compliance-handler', false, 5,  '/aml alerts'),
('/compliance',  'compliance', '合規檢查',               'founder', 'compliance-handler', false, 5,  '/compliance check [merchant_id]'),

-- 專利約束
('/path',        'l1l4',       '推理路徑驗證',            'founder', 'l1l4-handler',       false, 3,  '/path check [l1] [l2] [l3] [l4]'),
('/l1',          'l1l4',       '查看 L1 產業類別',        'user',    'l1l4-handler',       false, 5,  '/l1 list'),
('/l2',          'l1l4',       '查看 L2 次產業分類',      'user',    'l1l4-handler',       false, 5,  '/l2 list [l1_code]'),
('/l3',          'l1l4',       '查看 L3 製程類型',        'user',    'l1l4-handler',       false, 5,  '/l3 list [l2_code]'),
('/l4',          'l1l4',       '查看 L4 工業節點',        'user',    'l1l4-handler',       false, 5,  '/l4 list [l3_code]'),

-- 帳戶
('/me',          'account',    '查看自己的資訊',          'user',    'account-handler',    false, 5,  '/me'),
('/bind',        'account',    '綁定通訊軟體帳號',        'user',    'account-handler',    false, 0,  '/bind'),
('/help',        'account',    '顯示指令清單',            'user',    'account-handler',    false, 3,  '/help')
ON CONFLICT (command) DO NOTHING;
