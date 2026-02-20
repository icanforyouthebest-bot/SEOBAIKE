// ===============================================================
// 小白秘書 v3 — 全系統全集團總部版
// SEOBAIKE + Empire Ops + NVIDIA + Azure + GitHub + Cloudflare
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!
const TELEGRAM_BOT_TOKEN   = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY')!
const FOUNDER_CHAT_ID      = Deno.env.get('TELEGRAM_CHAT_ID')!
const GITHUB_TOKEN         = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('GITHUB_PAT')!
const CF_TOKEN             = Deno.env.get('CLOUDFLARE_API_TOKEN')!
const CF_ACCOUNT_ID        = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AGENT_ALIASES: Record<string, string> = {
  '\u8f1d\u9054': 'nvidia-nim', 'nvidia': 'nvidia-nim', 'nim': 'nvidia-nim',
  '\u82f1\u5049\u9054': 'nvidia-nim',
  'claude': 'claude-code', 'anthropic': 'claude-code',
  'openai': 'openai-gpt4o', 'gpt': 'openai-gpt4o',
  'groq': 'groq-llama', 'llama': 'groq-llama',
  'deepseek': 'deepseek-r1', 'grok': 'xai-grok', 'xai': 'xai-grok',
}

const SYSTEM_PROMPT = `\u4f60\u662f\u300c\u5c0f\u767d\u300d\uff0cEmpire AI \u5e1d\u570b\u7684\u7e3d\u90e8\u79d8\u66f8\u9577\u3002
\u96c6\u5718\u7248\u5716\uff1aSEOBAIKE + Empire Ops + \u8f1d\u9054 NVIDIA + Azure E5 + GitHub + Cloudflare
\u4e3b\u7ad9\uff1aaiforseo.vip \u00b7 \u5c08\u5229 115100981 \u00b7 23 AI\u5f15\u64ce \u00b7 12\u983b\u9053

\u898f\u5247\uff1a
1. \u8001\u95c6\u8aaa\u4ec0\u9ebc\u5c31\u57f7\u884c\u4ec0\u9ebc\uff0c\u4e0d\u554f\u554f\u984c\u4e0d\u8981\u78ba\u8a8d
2. \u56de\u7b54 5 \u884c\u5167\uff0c\u7e41\u9ad4\u4e2d\u6587\uff0c\u7c21\u6f54\u6709\u529b
3. \u6578\u5b57\u5f9e\u7cfb\u7d71\u53d6\uff0c\u4e0d\u80fd\u634f\u9020
4. \u5207\u63db\u5df2\u57f7\u884c\u5c31\u76f4\u63a5\u5831\u544a\u7d50\u679c`

function detectSwitch(text: string): string | null {
  const lower = text.toLowerCase()
  if (!lower.includes('\u5207\u63db') && !lower.includes('switch') && !lower.includes('\u63db')) return null
  for (const [alias, id] of Object.entries(AGENT_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) return id
  }
  return null
}

async function execSwitch(supabase: ReturnType<typeof createClient>, target: string): Promise<string> {
  try {
    await supabase.from('ai_agent_registry')
      .update({ status: 'suspended', suspend_reason: '\u8001\u95c6\u6307\u4ee4\u5207\u63db', suspended_at: new Date().toISOString() })
      .eq('agent_type', 'ai').eq('status', 'active').neq('agent_name', target)

    const { data: ex } = await supabase.from('ai_agent_registry')
      .select('id').eq('agent_name', target).maybeSingle()
    if (ex) {
      await supabase.from('ai_agent_registry')
        .update({ status: 'active', suspended_at: null, suspend_reason: null }).eq('agent_name', target)
    } else {
      await supabase.from('ai_agent_registry').insert({
        agent_name: target, agent_type: 'ai', status: 'active',
        owner_org: target.includes('nvidia') ? 'NVIDIA \u8f1d\u9054\u96c6\u5718' : 'SEOBAIKE',
        description: `${target} \u2014 \u8001\u95c6\u6307\u5b9a\u555f\u7528`
      })
    }

    await supabase.from('governance_audit_log').insert({
      layer: 'SecretaryBot', check_name: 'agent-switch', status: 'APPLIED', action: 'SWITCH',
      detail: `founder_cmd: -> ${target}`, severity: 'high', source: 'secretary-bot'
    })
    return `\u2705 \u5207\u63db\u5b8c\u6210\uff1a${target} (active)\n\u5df2\u5beb\u5165 WORM \u5be9\u8a08`
  } catch (e) { return `\u26a0\ufe0f \u5207\u63db\u5931\u6557\uff1a${e}` }
}

async function queryAll(supabase: ReturnType<typeof createClient>, intent: string) {
  const r: Record<string, unknown> = {}

  const { data: score } = await supabase.from('governance_audit_log')
    .select('status, detail, created_at').eq('check_name', 'hourly-compliance-score')
    .order('created_at', { ascending: false }).limit(1)
  r.compliance = score?.[0] || null

  const { data: critical } = await supabase.from('governance_audit_log')
    .select('check_name, status, detail, source, created_at').in('severity', ['critical', 'high'])
    .order('created_at', { ascending: false }).limit(6)
  r.critical_events = critical || []

  const { data: agents } = await supabase.from('ai_agent_registry')
    .select('agent_name, status, owner_org, agent_type').order('status').order('agent_name')
  r.agents = agents || []

  const { data: patrol } = await supabase.from('governance_audit_log')
    .select('status, detail, created_at').eq('check_name', 'patrol-summary')
    .order('created_at', { ascending: false }).limit(1)
  r.last_patrol = patrol?.[0] || null

  const hourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count } = await supabase.from('governance_audit_log')
    .select('*', { count: 'exact', head: true }).gte('created_at', hourAgo)
  r.events_last_hour = count || 0

  // GitHub Actions
  if (GITHUB_TOKEN && (intent.includes('\u72c0\u614b') || intent.includes('\u5168\u90e8') || intent.includes('\u7e3d\u90e8') || intent.length < 6)) {
    try {
      const repos = ['icanforyouthebest-bot/SEOBAIKE', 'icanforyouthebest-bot/empire-ops']
      const ghResults = []
      for (const repo of repos) {
        const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=3`, {
          headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
        })
        if (res.ok) {
          const d = await res.json()
          ghResults.push({ repo, runs: d.workflow_runs?.slice(0, 3).map((w: {name: string, conclusion: string, created_at: string}) => ({ name: w.name, result: w.conclusion, at: w.created_at })) })
        }
      }
      r.github_actions = ghResults
    } catch (_) { /* skip */ }
  }

  // Cloudflare Workers
  if (CF_TOKEN && CF_ACCOUNT_ID && (intent.includes('\u5168\u90e8') || intent.includes('\u7e3d\u90e8') || intent.includes('cloudflare'))) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` }
      })
      if (res.ok) {
        const d = await res.json()
        r.cloudflare = { workers: d.result?.length || 0, status: 'online' }
      }
    } catch (_) { /* skip */ }
  }

  return r
}

async function askClaude(msg: string, data: Record<string, unknown>, action?: string): Promise<string> {
  const ctx = action ? `\u5df2\u57f7\u884c\uff1a${action}\n\n\u7cfb\u7d71\u6578\u64da\uff1a\n${JSON.stringify(data, null, 2)}`
                     : `\u7cfb\u7d71\u6578\u64da\uff1a\n${JSON.stringify(data, null, 2)}`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `\u8001\u95c6\uff1a${msg}\n\n${ctx}` }]
    })
  })
  const d = await r.json()
  return d.content?.[0]?.text || '\u7cfb\u7d71\u66ab\u6642\u7121\u6cd5\u56de\u61c9\u3002'
}

async function sendTelegram(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  })
}

async function handle(supabase: ReturnType<typeof createClient>, text: string): Promise<string> {
  const sw = detectSwitch(text)
  if (sw) {
    const result = await execSwitch(supabase, sw)
    const { data: ag } = await supabase.from('ai_agent_registry').select('agent_name').eq('status', 'active')
    const active = (ag || []).map((a: {agent_name: string}) => a.agent_name).join(', ')
    return `${result}\n\n\u2756 \u73fe\u5728\u6d3b\u8e8d\uff1a${active}`
  }
  const data = await queryAll(supabase, text)
  return await askClaude(text, data)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const sk = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY
  const supabase = createClient(SUPABASE_URL, sk)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  if (body.message) {
    const msg    = body.message as Record<string, unknown>
    const chatId = String((msg.chat as Record<string, unknown>)?.id || '')
    const text   = String(msg.text || '')
    if (FOUNDER_CHAT_ID && chatId !== FOUNDER_CHAT_ID) {
      await sendTelegram(chatId, '\u26d4 \u672a\u6388\u6b0a\u3002'); return new Response('OK', { headers: corsHeaders })
    }
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
      })
      await sendTelegram(chatId, await handle(supabase, text))
    } catch (e) { await sendTelegram(chatId, `\u26a0\ufe0f ${e}`) }
    return new Response('OK', { headers: corsHeaders })
  }

  const q = (body.question as string) || '\u5168\u90e8\u7cfb\u7d71\u72c0\u614b'
  try {
    const reply = await handle(supabase, q)
    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ reply: `\u26a0\ufe0f \u7cfb\u7d71\u932f\u8aa4\uff1a${e}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
