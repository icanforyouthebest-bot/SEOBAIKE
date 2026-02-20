// ===============================================================
// n8n Governance Webhook — Supabase Edge Function
// n8n-automation must go through this gateway before execution
// Validates n8n workflow execution against governance rules
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-n8n-workflow, x-n8n-execution',
}

// n8n workflows allowed to execute
const ALLOWED_N8N_WORKFLOWS = new Set([
  'seobaike-content-pipeline',
  'seobaike-seo-report',
  'empire-daily-digest',
  'empire-alert-router',
  'marketplace-sync',
  'commission-calculator',
  'user-onboarding',
  'health-check-notify',
])

// n8n actions forbidden
const FORBIDDEN_N8N_ACTIONS = new Set([
  'modify_user_data',
  'delete_records',
  'modify_permissions',
  'bypass_auth',
  'direct_db_write',
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const workflowId  = req.headers.get('x-n8n-workflow') || 'unknown'
  const executionId = req.headers.get('x-n8n-execution') || crypto.randomUUID()
  const actionId    = crypto.randomUUID()

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  const action    = (body.action as string) || 'unknown'
  const agentInfo = `n8n:${workflowId}:${executionId}`

  async function audit(step: string, status: string, detail: string, severity = 'info') {
    try {
      await supabase.from('governance_audit_log').insert({
        layer:      'N8NGovernance',
        check_name: `n8n-${workflowId}-${step}`,
        status,
        action:     action,
        detail:     `agent=n8n-automation workflow=${workflowId} execution=${executionId} | ${detail}`,
        severity,
        source:     'n8n-governance-webhook',
        metadata:   { workflow_id: workflowId, execution_id: executionId, action_id: actionId },
      })
    } catch { /* non-blocking */ }
  }

  function block(reason: string, code = 403) {
    audit('BLOCKED', 'BLOCKED', reason, 'critical')
    return new Response(JSON.stringify({
      error:        'N8N_GOVERNANCE_BLOCKED',
      reason,
      workflow:     workflowId,
      execution:    executionId,
      action_id:    actionId,
      mandate:      'All n8n workflows must be registered and produce evidence.',
    }), { status: code, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // ── Gate 1: Workflow must be registered ────────────────────
  if (workflowId !== 'unknown' && !ALLOWED_N8N_WORKFLOWS.has(workflowId)) {
    return block(`n8n workflow '${workflowId}' is NOT in the approved list.`)
  }

  // ── Gate 2: Action must not be forbidden ───────────────────
  if (FORBIDDEN_N8N_ACTIONS.has(action)) {
    return block(`n8n action '${action}' is FORBIDDEN.`)
  }

  // ── Gate 3: Rate limit (50/min per workflow) ───────────────
  const { count } = await supabase
    .from('governance_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'n8n-governance-webhook')
    .like('detail', `%workflow=${workflowId}%`)
    .gte('created_at', new Date(Date.now() - 60000).toISOString())

  if ((count || 0) > 50) {
    return block(`Rate limit exceeded for workflow '${workflowId}'. Max 50/min.`, 429)
  }

  await audit('GATE-PASS', 'OK', `All gates passed. n8n workflow authorized.`)

  // ── Write evidence before ──────────────────────────────────
  const before = {
    phase:        'before',
    ai_agent:     'n8n-automation',
    workflow_id:  workflowId,
    execution_id: executionId,
    action_id:    actionId,
    action,
    timestamp:    new Date().toISOString(),
    input:        body,
  }

  const { data: evidenceData } = await supabase.from('governance_audit_log').insert({
    layer:      'N8NEvidence',
    check_name: `n8n-${workflowId}-before-${actionId}`,
    status:     'LOGGED',
    action:     'EVIDENCE_WRITTEN',
    detail:     `agent=n8n-automation workflow=${workflowId} phase=before action_id=${actionId}`,
    severity:   'info',
    source:     'n8n-governance-webhook',
    metadata:   before,
  }).select().single()

  return new Response(JSON.stringify({
    authorized:   true,
    workflow:     workflowId,
    execution_id: executionId,
    action_id:    actionId,
    evidence_id:  evidenceData?.id,
    mandate:      'n8n workflow authorized. Produce After+Diff evidence on completion.',
    gates_passed: ['workflow-registry', 'action-whitelist', 'rate-limit'],
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
