-- Dynamic AI Agent Registry
-- Allows switching AI agents without code deployment
-- Insert/delete rows = instant effect on all gateways

CREATE TABLE IF NOT EXISTS ai_agent_registry (
    id           BIGSERIAL PRIMARY KEY,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    agent_name   TEXT NOT NULL UNIQUE,
    agent_type   TEXT NOT NULL DEFAULT 'ai',  -- ai | automation | human
    status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','retired')),
    owner_org    TEXT,          -- e.g. '輝達集團', 'empire-ops', 'claude-anthropic'
    description  TEXT,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suspended_at  TIMESTAMPTZ,
    suspend_reason TEXT
);

-- Seed with current registry
INSERT INTO ai_agent_registry (agent_name, agent_type, status, owner_org, description) VALUES
    ('claude-code',             'ai',         'active',    'Anthropic',   'Claude Code AI agent — code & deployment'),
    ('github-actions',          'automation', 'active',    'empire-ops',  'GitHub Actions CI/CD automation'),
    ('azure-automation',        'automation', 'active',    'empire-ops',  'Azure Automation runbooks'),
    ('supabase-edge',           'automation', 'active',    'empire-ops',  'Supabase Edge Functions'),
    ('empire-self-heal',        'automation', 'active',    'empire-ops',  'Self-heal patrol automation'),
    ('empire-governance',       'automation', 'active',    'empire-ops',  'Governance enforcement automation'),
    ('e5-automation',           'automation', 'active',    'empire-ops',  'E5 license and Azure automation'),
    ('seobaike-deploy',         'automation', 'active',    'empire-ops',  'SEOBAIKE deployment pipeline'),
    ('seobaike-security-gate',  'automation', 'active',    'empire-ops',  'SEOBAIKE security gate'),
    ('mcp-agent',               'ai',         'active',    'empire-ops',  'MCP protocol AI agent'),
    ('n8n-automation',          'automation', 'active',    'empire-ops',  'n8n workflow automation')
ON CONFLICT (agent_name) DO NOTHING;

-- RLS: anyone can read, only service role can write
ALTER TABLE ai_agent_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registry_select" ON ai_agent_registry FOR SELECT USING (true);
CREATE POLICY "registry_insert" ON ai_agent_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "registry_update" ON ai_agent_registry FOR UPDATE USING (true);
-- NO delete policy = registry entries preserved (audit trail)

-- View: active agents only
CREATE OR REPLACE VIEW active_ai_agents AS
    SELECT agent_name, agent_type, owner_org, description, registered_at
    FROM ai_agent_registry
    WHERE status = 'active';
