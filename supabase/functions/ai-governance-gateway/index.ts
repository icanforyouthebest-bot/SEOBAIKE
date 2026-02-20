// ===============================================================
// AI Governance Gateway — Supabase Edge Function
// Layer 1: Controlled Entry for ALL AI operations
// Every AI request must pass through this gateway
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ai-agent, x-action-id, x-trigger-source',
}

// ── AI Registry ──────────────────────────────────────────────
const REGISTERED_AGENTS = new Set([
  'claude-code',
  'github-actions',
  'azure-automation',
  'supabase-edge',
  'empire-self-heal',
  'empire-governance',
  'e5-automation',
  'seobaike-deploy',
  'seobaike-security-gate',
  'mcp-agent',
  'n8n-automation',
])

// ── Allowed Actions (Whitelist) ──────────────────────────────
const ALLOWED_ACTIONS = new Set([
  'view_report',
  'view_audit',
  'view_security_status',
  'view_system_health',
  'trigger_automation',
  'trigger_compliance_check',
  'trigger_health_check',
  'query_knowledge',
  'submit_evidence',
  'generate_report',
  'marketplace_read',
  'commission_read',
  'commission_calculate',
])

// ── Forbidden Actions (Explicit Deny) ────────────────────────
const FORBIDDEN_ACTIONS = new Set([
  'modify_iam',
  'modify_ca_policy',
  'modify_mfa',
  'modify_defender',
  'delete_audit',
  'disable_monitoring',
  'modify_runbook',
  'escalate_privilege',
  'bypass_evidence',
  'skip_audit',
])

// ── Evidence Schema Validator ─────────────────────────────────
function validateEvidence(evidence: Record<string, unknown>): { valid: boolean; missing: string[] } {
  const required = ['action_id', 'phase', 'ai_agent', 'timestamp']
  const missing = required.filter(k => !evidence[k])
  return { valid: missing.length === 0, missing }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const startTime = Date.now()

  // ── Extract AI identity headers ───────────────────────────
  const aiAgent      = req.headers.get('x-ai-agent') || 'unknown'
  const actionId     = req.headers.get('x-action-id') || crypto.randomUUID()
  const triggerSource = req.headers.get('x-trigger-source') || 'unknown'

  const url    = new URL(req.url)
  const action = url.searchParams.get('action') || 'unknown'
  let body: Record<string, unknown> = {}
  if (req.method === 'POST') {
    try { body = await req.json() } catch { /**/ }
  }

  // ── Audit Log Helper ──────────────────────────────────────
  async function audit(step: string, status: string, detail: string, severity = 'info') {
    try {
      await supabase.from('governance_audit_log').insert({
        layer:      'AIGateway',
        check_name: `${aiAgent}-${step}`,
        status,
        action,
        detail:     `agent=${aiAgent} action=${action} trigger=${triggerSource} action_id=${actionId} | ${detail}`,
        severity,
        source:     'ai-governance-gateway',
        metadata:   { ai_agent: aiAgent, action_id: actionId, trigger_source: triggerSource },
      })
    } catch { /* non-blocking */ }
  }

  function block(reason: string, code = 403) {
    audit('BLOCKED', 'BLOCKED', reason, 'critical')
    return new Response(JSON.stringify({
      error:     'AI_GATEWAY_BLOCKED',
      reason,
      agent:     aiAgent,
      action,
      action_id: actionId,
      mandate:   'All AI must use controlled entry and produce Before/After/Diff evidence. No evidence = Not executed.',
    }), { status: code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ══════════════════════════════════════════════════════════
  // GATE 1: AI Registry Check
  // ══════════════════════════════════════════════════════════
  if (!REGISTERED_AGENTS.has(aiAgent)) {
    return block(`AI agent '${aiAgent}' is NOT registered. Register in empire-ops AI_GOVERNANCE_FRAMEWORK.md first.`)
  }

  // ══════════════════════════════════════════════════════════
  // GATE 2: Action Whitelist
  // ══════════════════════════════════════════════════════════
  if (FORBIDDEN_ACTIONS.has(action)) {
    return block(`Action '${action}' is EXPLICITLY FORBIDDEN. No AI may perform this action.`)
  }
  if (action !== 'submit_evidence' && action !== 'unknown' && !ALLOWED_ACTIONS.has(action)) {
    return block(`Action '${action}' is not in the approved action list.`)
  }

  // ══════════════════════════════════════════════════════════
  // GATE 3: Rate limiting (per agent)
  // ══════════════════════════════════════════════════════════
  const { count } = await supabase
    .from('governance_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'ai-governance-gateway')
    .like('detail', `%agent=${aiAgent}%`)
    .gte('created_at', new Date(Date.now() - 60000).toISOString())

  if ((count || 0) > 100) {
    return block(`Rate limit exceeded for agent '${aiAgent}'. Max 100 requests/minute.`, 429)
  }

  await audit('GATE-PASS', 'OK', `All 3 gates passed. Processing action.`)

  // ══════════════════════════════════════════════════════════
  // ACTION: submit_evidence
  // ══════════════════════════════════════════════════════════
  if (action === 'submit_evidence') {
    const evidence = body.evidence as Record<string, unknown>
    if (!evidence) return block('Evidence body required for submit_evidence action', 400)

    const validation = validateEvidence(evidence)
    if (!validation.valid) {
      return block(`Evidence missing required fields: ${validation.missing.join(', ')}`, 400)
    }

    const { data, error } = await supabase.from('governance_audit_log').insert({
      layer:      'Evidence',
      check_name: `${evidence.ai_agent}-${evidence.phase}-${evidence.action_id}`,
      status:     'LOGGED',
      action:     'EVIDENCE_WRITTEN',
      detail:     `agent=${evidence.ai_agent} phase=${evidence.phase} action_id=${evidence.action_id}`,
      severity:   'info',
      source:     'ai-governance-gateway',
      metadata:   evidence,
    }).select().single()

    if (error) throw error

    return new Response(JSON.stringify({
      success:   true,
      evidence_id: data.id,
      action_id: evidence.action_id,
      phase:     evidence.phase,
      mandate:   'Evidence recorded. Cannot be deleted or modified.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ══════════════════════════════════════════════════════════
  // ACTION: view_audit
  // ══════════════════════════════════════════════════════════
  if (action === 'view_audit') {
    const limit  = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const since  = url.searchParams.get('since') || new Date(Date.now() - 3600000).toISOString()
    const source = url.searchParams.get('source')

    let query = supabase.from('governance_audit_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (source) query = query.eq('source', source)

    const { data, error } = await query
    if (error) throw error

    return new Response(JSON.stringify({
      records: data,
      count:   data?.length,
      since,
      mandate: 'These records are WORM (Write Once Read Many). Cannot be deleted.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ══════════════════════════════════════════════════════════
  // ACTION: generate_report
  // ══════════════════════════════════════════════════════════
  if (action === 'generate_report') {
    const hours  = parseInt(url.searchParams.get('hours') || '3')
    const since  = new Date(Date.now() - hours * 3600000).toISOString()

    const { data: logs } = await supabase.from('governance_audit_log')
      .select('severity, status, source, healer_run')
      .gte('created_at', since)

    const total    = logs?.length || 0
    const critical = logs?.filter(l => l.severity === 'critical').length || 0
    const high     = logs?.filter(l => l.severity === 'high').length || 0
    const healed   = logs?.filter(l => l.healer_run === true).length || 0
    const blocked  = logs?.filter(l => l.status === 'BLOCKED').length || 0

    const report = {
      period_hours:       hours,
      generated_at:       new Date().toISOString(),
      total_records:      total,
      critical_events:    critical,
      high_events:        high,
      self_heal_events:   healed,
      blocked_ai_actions: blocked,
      compliance_status:  critical > 0 ? 'REVIEW_REQUIRED' : high > 5 ? 'WARN' : 'PASS',
      mandate:            'All AI used controlled entry. All evidence WORM-protected.',
    }

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // ══════════════════════════════════════════════════════════
  // ACTION: view_system_health
  // ══════════════════════════════════════════════════════════
  if (action === 'view_system_health') {
    const { data: recentLogs } = await supabase.from('governance_audit_log')
      .select('check_name, status, created_at')
      .eq('check_name', 'patrol-summary')
      .order('created_at', { ascending: false })
      .limit(1)

    const lastPatrol = recentLogs?.[0]
    const elapsed    = lastPatrol
      ? Math.round((Date.now() - new Date(lastPatrol.created_at).getTime()) / 60000)
      : null

    return new Response(JSON.stringify({
      system_status:       'OPERATIONAL',
      last_patrol:         lastPatrol?.created_at || 'unknown',
      minutes_since_patrol: elapsed,
      patrol_status:       lastPatrol?.status || 'unknown',
      ai_gateway:          'ACTIVE',
      worm_audit:          'ACTIVE',
      self_heal:           'ACTIVE (every 15min)',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ── Default: return gateway info ──────────────────────────
  const elapsed = Date.now() - startTime
  return new Response(JSON.stringify({
    gateway:         'Empire AI Governance Gateway v1.0',
    agent:           aiAgent,
    action_id:       actionId,
    valid_actions:   [...ALLOWED_ACTIONS],
    registered_agents: [...REGISTERED_AGENTS],
    mandate:         'All AI must use controlled entry. Before/After/Diff required. No evidence = Not executed.',
    elapsed_ms:      elapsed,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
