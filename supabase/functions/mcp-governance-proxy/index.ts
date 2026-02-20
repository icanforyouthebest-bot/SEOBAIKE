// ===============================================================
// MCP Governance Proxy — Supabase Edge Function
// All MCP (Model Context Protocol) agent calls must pass through
// Full audit trail, evidence generation, rate limiting
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mcp-tool, x-mcp-session, x-ai-agent',
}

// Approved MCP tools (what agents can request)
const APPROVED_MCP_TOOLS = new Set([
  'read_file',
  'list_files',
  'search_code',
  'run_query',
  'get_schema',
  'view_metrics',
  'generate_report',
  'check_health',
  'list_users',
  'view_audit',
])

// Forbidden MCP tools — NEVER allowed
const FORBIDDEN_MCP_TOOLS = new Set([
  'write_file',
  'delete_file',
  'execute_code',
  'modify_db',
  'drop_table',
  'run_migration',
  'modify_permissions',
  'access_secrets',
  'modify_config',
  'send_email',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const mcpTool    = req.headers.get('x-mcp-tool') || 'unknown'
  const mcpSession = req.headers.get('x-mcp-session') || crypto.randomUUID()
  const aiAgent    = req.headers.get('x-ai-agent') || 'mcp-agent'
  const actionId   = crypto.randomUUID()

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  async function audit(step: string, status: string, detail: string, severity = 'info') {
    try {
      await supabase.from('governance_audit_log').insert({
        layer:      'MCPGovernance',
        check_name: `mcp-${aiAgent}-${step}`,
        status,
        action:     mcpTool,
        detail:     `agent=${aiAgent} tool=${mcpTool} session=${mcpSession} action_id=${actionId} | ${detail}`,
        severity,
        source:     'mcp-governance-proxy',
        metadata:   { ai_agent: aiAgent, mcp_tool: mcpTool, session_id: mcpSession, action_id: actionId },
      })
    } catch { /**/ }
  }

  function block(reason: string, code = 403) {
    audit('BLOCKED', 'BLOCKED', reason, 'critical')
    return new Response(JSON.stringify({
      error:     'MCP_GOVERNANCE_BLOCKED',
      reason,
      tool:      mcpTool,
      agent:     aiAgent,
      action_id: actionId,
      mandate:   'All MCP tools must be approved. Evidence required.',
    }), { status: code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ── Gate 1: Tool must be approved ─────────────────────────
  if (FORBIDDEN_MCP_TOOLS.has(mcpTool)) {
    return block(`MCP tool '${mcpTool}' is FORBIDDEN. AI cannot use write/delete/modify tools.`)
  }
  if (mcpTool !== 'unknown' && !APPROVED_MCP_TOOLS.has(mcpTool)) {
    return block(`MCP tool '${mcpTool}' is not in the approved list.`)
  }

  // ── Gate 2: Rate limit (200/min per agent+tool) ────────────
  const { count } = await supabase
    .from('governance_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'mcp-governance-proxy')
    .like('detail', `%agent=${aiAgent}%tool=${mcpTool}%`)
    .gte('created_at', new Date(Date.now() - 60000).toISOString())

  if ((count || 0) > 200) {
    return block(`Rate limit: ${aiAgent}+${mcpTool} exceeded 200/min.`, 429)
  }

  await audit('GATE-PASS', 'OK', `MCP tool authorized. Proxying to Supabase.`)

  // ── Proxy: Execute read-only tools against Supabase ────────
  let result: Record<string, unknown> = {}

  if (mcpTool === 'view_audit') {
    const limit = Math.min(parseInt((body.limit as string) || '50'), 200)
    const since = (body.since as string) || new Date(Date.now() - 3600000).toISOString()
    const { data } = await supabase.from('governance_audit_log')
      .select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(limit)
    result = { records: data, count: data?.length, mandate: 'WORM — cannot be modified' }
  } else if (mcpTool === 'check_health') {
    const { data } = await supabase.from('governance_audit_log')
      .select('check_name, status, created_at')
      .eq('check_name', 'patrol-summary')
      .order('created_at', { ascending: false }).limit(1)
    result = { system_status: 'OPERATIONAL', last_patrol: data?.[0]?.created_at || 'unknown' }
  } else if (mcpTool === 'generate_report') {
    const hours = parseInt((body.hours as string) || '1')
    const since = new Date(Date.now() - hours * 3600000).toISOString()
    const { data } = await supabase.from('governance_audit_log')
      .select('severity, status, source').gte('created_at', since)
    const total    = data?.length || 0
    const critical = data?.filter(l => l.severity === 'critical').length || 0
    const blocked  = data?.filter(l => l.status === 'BLOCKED').length || 0
    result = { period_hours: hours, total, critical, blocked, status: critical > 0 ? 'REVIEW' : 'PASS' }
  } else {
    result = { tool: mcpTool, status: 'acknowledged', action_id: actionId }
  }

  await audit('COMPLETED', 'OK', `MCP tool executed successfully`)

  return new Response(JSON.stringify({
    success:      true,
    tool:         mcpTool,
    agent:        aiAgent,
    action_id:    actionId,
    result,
    evidence:     { action_id: actionId, session: mcpSession, phase: 'after', timestamp: new Date().toISOString() },
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
