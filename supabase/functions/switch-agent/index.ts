// ===============================================================
// Switch Agent API — Supabase Edge Function
// 創辦人可以隨時切換 AI agent — 不需要 code deploy
// POST /functions/v1/switch-agent
// Body: { old_agent: "claude-code", new_agent: "gpt-4o", reason: "..." }
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-founder-key',
}

// Founder key for authentication (set as secret)
const FOUNDER_KEY = Deno.env.get('FOUNDER_API_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Auth: founder key required
  const founderKey = req.headers.get('x-founder-key') || ''
  if (FOUNDER_KEY && founderKey !== FOUNDER_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized — x-founder-key required' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  let body: Record<string, string> = {}
  try { body = await req.json() } catch { /**/ }

  const action    = body.action || 'list'    // list | switch | suspend | activate
  const oldAgent  = body.old_agent || ''
  const newAgent  = body.new_agent || ''
  const ownerOrg  = body.owner_org || 'empire-ops'
  const reason    = body.reason || 'founder-command'
  const switchId  = crypto.randomUUID()

  async function auditSwitch(event: string, detail: string, severity = 'info') {
    await supabase.from('governance_audit_log').insert({
      layer: 'AgentSwitch', check_name: `switch-${event}`, status: 'OK',
      action: action, detail: `switch_id=${switchId} old=${oldAgent} new=${newAgent} reason=${reason} | ${detail}`,
      severity, source: 'switch-agent-api',
      metadata: { switch_id: switchId, old_agent: oldAgent, new_agent: newAgent, reason }
    })
  }

  // ── LIST: show all active agents ───────────────────────────
  if (action === 'list') {
    const { data } = await supabase.from('ai_agent_registry')
      .select('agent_name, agent_type, status, owner_org, description, registered_at')
      .order('status').order('agent_name')
    return new Response(JSON.stringify({
      agents: data,
      total: data?.length,
      mandate: 'Switch agents via POST with action=switch. No code deploy needed.',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ── SWITCH: suspend old, activate/add new ──────────────────
  if (action === 'switch') {
    if (!newAgent) {
      return new Response(JSON.stringify({ error: 'new_agent required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const results: Record<string, unknown> = {}

    // Suspend old agent
    if (oldAgent) {
      const { error: suspendErr } = await supabase.from('ai_agent_registry')
        .update({ status: 'suspended', suspended_at: new Date().toISOString(), suspend_reason: reason })
        .eq('agent_name', oldAgent)
      results.old_agent = suspendErr ? `FAIL: ${suspendErr.message}` : `SUSPENDED: ${oldAgent}`
    }

    // Activate or insert new agent
    const { data: existing } = await supabase.from('ai_agent_registry')
      .select('id').eq('agent_name', newAgent).single()

    if (existing) {
      await supabase.from('ai_agent_registry')
        .update({ status: 'active', suspended_at: null, suspend_reason: null })
        .eq('agent_name', newAgent)
      results.new_agent = `ACTIVATED: ${newAgent}`
    } else {
      await supabase.from('ai_agent_registry').insert({
        agent_name: newAgent, agent_type: 'ai', status: 'active',
        owner_org: ownerOrg, description: `Added via switch-agent API — reason: ${reason}`
      })
      results.new_agent = `CREATED+ACTIVATED: ${newAgent}`
    }

    await auditSwitch('SWITCH', `${oldAgent || 'none'} → ${newAgent}`, 'info')

    return new Response(JSON.stringify({
      success:   true,
      switch_id: switchId,
      results,
      effective: 'IMMEDIATELY — all gateways now use updated registry',
      audit:     'Logged to WORM governance_audit_log',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ── SUSPEND: suspend one agent ─────────────────────────────
  if (action === 'suspend') {
    if (!oldAgent) return new Response(JSON.stringify({ error: 'old_agent required' }), { status: 400, headers: corsHeaders })
    await supabase.from('ai_agent_registry')
      .update({ status: 'suspended', suspended_at: new Date().toISOString(), suspend_reason: reason })
      .eq('agent_name', oldAgent)
    await auditSwitch('SUSPEND', `Suspended: ${oldAgent}`, 'high')
    return new Response(JSON.stringify({ success: true, suspended: oldAgent, effective: 'IMMEDIATELY' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // ── ACTIVATE: activate one agent ───────────────────────────
  if (action === 'activate') {
    if (!newAgent) return new Response(JSON.stringify({ error: 'new_agent required' }), { status: 400, headers: corsHeaders })
    const { data: ex } = await supabase.from('ai_agent_registry').select('id').eq('agent_name', newAgent).single()
    if (ex) {
      await supabase.from('ai_agent_registry').update({ status: 'active', suspended_at: null }).eq('agent_name', newAgent)
    } else {
      await supabase.from('ai_agent_registry').insert({
        agent_name: newAgent, agent_type: 'ai', status: 'active', owner_org: ownerOrg,
        description: `Activated via switch-agent API — reason: ${reason}`
      })
    }
    await auditSwitch('ACTIVATE', `Activated: ${newAgent}`)
    return new Response(JSON.stringify({ success: true, activated: newAgent, effective: 'IMMEDIATELY' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({
    actions: ['list', 'switch', 'suspend', 'activate'],
    usage: 'POST with { action, old_agent, new_agent, owner_org, reason }',
    example: '{ "action": "switch", "old_agent": "claude-code", "new_agent": "gpt-4o", "reason": "founder-switch" }',
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
