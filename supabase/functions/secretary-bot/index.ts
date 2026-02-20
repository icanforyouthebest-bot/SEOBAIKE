// ===============================================================
// 小白秘書 v4 — 全系統全集團 FINAL
// 老闆專屬總部秘書長
// 整合：Supabase · GitHub · Cloudflare · Azure AD · NVIDIA
//        SEOBAIKE · empire-ops · L1-L11 · 23 AI · 12 頻道
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── ENV ──────────────────────────────────────────────────────
const SB_URL   = Deno.env.get('SUPABASE_URL')!
const SB_SK    = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY'))!
const SB_ANON  = Deno.env.get('SUPABASE_ANON_KEY')!
const TG_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TG_OWNER = Deno.env.get('TELEGRAM_CHAT_ID')!
const AI_KEY   = (Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY'))!
const GH_TOKEN = (Deno.env.get('GITHUB_TOKEN') || Deno.env.get('GITHUB_PAT'))!
const CF_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN')!
const CF_ACCT  = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!
const CF_ZONE  = Deno.env.get('CLOUDFLARE_ZONE_ID')!
const NV_KEY   = (Deno.env.get('NVIDIA_API_KEY') || Deno.env.get('NVIDIA_AZURE_KEY'))!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── 代理人別名對照 ────────────────────────────────────────────
const ALIASES: Record<string, string> = {
  '輝達': 'nvidia-nim', 'nvidia': 'nvidia-nim', 'nim': 'nvidia-nim', '英偉達': 'nvidia-nim',
  'claude': 'claude-code', 'anthropic': 'claude-code',
  'openai': 'openai-gpt4o', 'gpt': 'openai-gpt4o', 'chatgpt': 'openai-gpt4o',
  'groq': 'groq-llama', 'llama': 'groq-llama',
  'deepseek': 'deepseek-r1', 'grok': 'xai-grok', 'xai': 'xai-grok',
  'mistral': 'mistral', 'together': 'together-ai',
  'perplexity': 'perplexity', 'openrouter': 'openrouter',
}

// ── System Prompt ─────────────────────────────────────────────
const PROMPT = `你是「小白」，Empire AI 帝國的總部秘書長。

集團版圖：
• 小路光有限公司 / SEOBAIKE (主站 aiforseo.vip，專利 115100981)
• Empire AI Governance (L1-L11 治理層)
• 輝達集團 NVIDIA (主力 GPU AI 代理人)
• Azure E5 + AD B2B 外部管理
• GitHub Actions CI/CD (SEOBAIKE + empire-ops)
• Cloudflare Workers 全球 300+ 節點

規則：
1. 老闆下令直接執行，不問問題不要確認
2. 5 行內簡潔具體，繁體中文
3. 數字從即時系統數據取得
4. 切換/執行已完成就直接報告結果`

// ── 偵測切換意圖 ──────────────────────────────────────────────
function detectSwitch(text: string): string | null {
  const lower = text.toLowerCase()
  if (!lower.includes('切換') && !lower.includes('switch') && !lower.includes('換')) return null
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (lower.includes(alias.toLowerCase())) return id
  }
  return null
}

// ── 執行切換 ──────────────────────────────────────────────────
async function doSwitch(sb: ReturnType<typeof createClient>, target: string): Promise<string> {
  try {
    await sb.from('ai_agent_registry')
      .update({ status: 'suspended', suspend_reason: '老闆切換指令', suspended_at: new Date().toISOString() })
      .eq('agent_type', 'ai').eq('status', 'active').neq('agent_name', target)

    const { data: ex } = await sb.from('ai_agent_registry')
      .select('id').eq('agent_name', target).maybeSingle()
    if (ex) {
      await sb.from('ai_agent_registry')
        .update({ status: 'active', suspended_at: null, suspend_reason: null })
        .eq('agent_name', target)
    } else {
      await sb.from('ai_agent_registry').insert({
        agent_name: target, agent_type: 'ai', status: 'active',
        owner_org: target.includes('nvidia') ? 'NVIDIA 輝達集團' : 'SEOBAIKE',
        description: `${target} — 老闆指定啟用`
      })
    }

    await sb.from('governance_audit_log').insert({
      layer: 'SecretaryBot', check_name: 'agent-switch', status: 'APPLIED', action: 'SWITCH',
      detail: `founder_cmd: -> ${target}`, severity: 'high', source: 'secretary-bot'
    })
    return `✅ 已切換到 ${target}\n已寫入 WORM 審計`
  } catch (e) {
    return `⚠️ 切換失敗：${e}`
  }
}

// ── Supabase 治理全查詢 ───────────────────────────────────────
async function qSupabase(sb: ReturnType<typeof createClient>, intent: string) {
  const r: Record<string, unknown> = {}

  const { data: sc } = await sb.from('governance_audit_log')
    .select('status, detail, created_at').eq('check_name', 'hourly-compliance-score')
    .order('created_at', { ascending: false }).limit(1)
  r.compliance = sc?.[0] || null

  const { data: cr } = await sb.from('governance_audit_log')
    .select('layer, check_name, status, detail, severity, source, created_at')
    .in('severity', ['critical', 'high']).order('created_at', { ascending: false }).limit(10)
  r.critical = cr || []

  const { data: ag } = await sb.from('ai_agent_registry')
    .select('agent_name, status, owner_org, agent_type').order('status').order('agent_name')
  r.agents = ag || []

  const { data: pt } = await sb.from('governance_audit_log')
    .select('status, detail, created_at').eq('check_name', 'patrol-summary')
    .order('created_at', { ascending: false }).limit(1)
  r.patrol = pt?.[0] || null

  const hourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count } = await sb.from('governance_audit_log')
    .select('*', { count: 'exact', head: true }).gte('created_at', hourAgo)
  r.events_1h = count || 0

  const { data: layers } = await sb.from('governance_audit_log')
    .select('layer, check_name, status, created_at')
    .not('layer', 'is', null).order('created_at', { ascending: false }).limit(30)
  r.layers = layers || []

  if (intent.includes('封鎖') || intent.includes('block') || intent.includes('安全')) {
    const { data: bl } = await sb.from('governance_audit_log')
      .select('check_name, detail, created_at').eq('status', 'BLOCKED')
      .order('created_at', { ascending: false }).limit(8)
    r.blocked = bl || []
  }

  const { data: rec } = await sb.from('governance_audit_log')
    .select('check_name, status, action, detail, created_at')
    .order('created_at', { ascending: false }).limit(5)
  r.recent = rec || []

  return r
}

// ── GitHub Actions ────────────────────────────────────────────
async function qGitHub() {
  if (!GH_TOKEN) return { error: 'no token' }
  const repos = ['icanforyouthebest-bot/SEOBAIKE', 'icanforyouthebest-bot/empire-ops']
  const out: unknown[] = []
  for (const repo of repos) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=5`, {
        headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
      })
      if (!res.ok) { out.push({ repo, error: res.status }); continue }
      const d = await res.json()
      out.push({
        repo, runs: d.workflow_runs?.slice(0, 5).map((w: { name: string, conclusion: string, status: string, created_at: string }) => ({
          name: w.name, result: w.conclusion || w.status, at: w.created_at.substring(0, 16)
        }))
      })
    } catch (e) { out.push({ repo, error: String(e) }) }
  }
  return { repos: out }
}

// ── Cloudflare ────────────────────────────────────────────────
async function qCloudflare() {
  if (!CF_TOKEN) return { error: 'no token' }
  const r: Record<string, unknown> = {}
  try {
    const wr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/workers/scripts`,
      { headers: { Authorization: `Bearer ${CF_TOKEN}` } })
    if (wr.ok) { const d = await wr.json(); r.workers = d.result?.length || 0 }

    if (CF_ZONE) {
      const zr = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE}`,
        { headers: { Authorization: `Bearer ${CF_TOKEN}` } })
      if (zr.ok) { const d = await zr.json(); r.zone = { name: d.result?.name, status: d.result?.status } }
    }
    r.status = 'online'
  } catch (e) { r.error = String(e) }
  return r
}

// ── SEOBAIKE 健康 ─────────────────────────────────────────────
async function qSEOBAIKE() {
  const eps = [
    { name: '主站', url: 'https://www.aiforseo.vip' },
    { name: 'AI Gateway', url: `${SB_URL}/functions/v1/ai-governance-gateway` },
    { name: 'CEO Dashboard', url: `${SB_URL}/functions/v1/ceo-dashboard` },
  ]
  const results = []
  for (const ep of eps) {
    try {
      const res = await fetch(ep.url, { signal: AbortSignal.timeout(5000) })
      results.push({ name: ep.name, status: res.ok ? 'online' : 'error', code: res.status })
    } catch {
      results.push({ name: ep.name, status: 'offline' })
    }
  }
  return results
}

// ── NVIDIA 健康 ───────────────────────────────────────────────
async function qNVIDIA() {
  if (!NV_KEY) return { status: 'no key' }
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { Authorization: `Bearer ${NV_KEY}` },
      signal: AbortSignal.timeout(5000)
    })
    return { status: res.ok ? 'online' : 'error', code: res.status }
  } catch {
    return { status: 'timeout' }
  }
}

// ── Claude Haiku ──────────────────────────────────────────────
async function askClaude(msg: string, data: Record<string, unknown>, action?: string): Promise<string> {
  const ctx = action
    ? `已執行：${action}\n\n系統數據：\n${JSON.stringify(data, null, 2)}`
    : `系統即時數據：\n${JSON.stringify(data, null, 2)}`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 500, system: PROMPT,
      messages: [{ role: 'user', content: `老闆：${msg}\n\n${ctx}` }]
    })
  })
  const d = await res.json()
  return d.content?.[0]?.text || '系統暫時無法回應。'
}

async function sendTG(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  })
}

// ── 主邏輯 ────────────────────────────────────────────────────
async function handle(sb: ReturnType<typeof createClient>, text: string): Promise<string> {
  const sw = detectSwitch(text)
  if (sw) {
    const result = await doSwitch(sb, sw)
    const { data: ag } = await sb.from('ai_agent_registry').select('agent_name').eq('status', 'active')
    const active = (ag || []).map((a: { agent_name: string }) => a.agent_name).join(', ')
    return `${result}\n✦ 現在活躍：${active}`
  }

  const isAll = text.includes('全部') || text.includes('狀態') || text.includes('總部') || text.length < 6
  const [gov, gh, cf, site, nv] = await Promise.all([
    qSupabase(sb, text),
    (isAll || text.includes('github') || text.includes('部署')) ? qGitHub() : Promise.resolve(null),
    (isAll || text.includes('cloudflare') || text.includes('節點')) ? qCloudflare() : Promise.resolve(null),
    (isAll || text.includes('網站') || text.includes('健康')) ? qSEOBAIKE() : Promise.resolve(null),
    (text.includes('輝達') || text.includes('nvidia') || isAll) ? qNVIDIA() : Promise.resolve(null),
  ])

  const all: Record<string, unknown> = { ...gov }
  if (gh)   all.github = gh
  if (cf)   all.cloudflare = cf
  if (site) all.seobaike_health = site
  if (nv)   all.nvidia = nv

  return await askClaude(text, all)
}

// ── Server ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const sb = createClient(SB_URL, SB_SK || SB_ANON)
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  // Telegram webhook
  if (body.message) {
    const msg    = body.message as Record<string, unknown>
    const chatId = String((msg.chat as Record<string, unknown>)?.id || '')
    const text   = String(msg.text || '')
    if (TG_OWNER && chatId !== TG_OWNER) {
      await sendTG(chatId, '⛔ 未授權。')
      return new Response('OK', { headers: CORS })
    }
    try {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendChatAction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
      })
      const reply = await handle(sb, text)
      await sendTG(chatId, reply)
      await sb.from('governance_audit_log').insert({
        layer: 'SecretaryBot', check_name: 'secretary-query', status: 'OK', action: 'QUERY',
        detail: `q=${text.substring(0, 100)}`, severity: 'info', source: 'secretary-bot'
      })
    } catch (e) { await sendTG(chatId, `⚠️ ${e}`) }
    return new Response('OK', { headers: CORS })
  }

  // Web widget
  const q = (body.question as string) || '全部系統狀態'
  try {
    const reply = await handle(sb, q)
    return new Response(JSON.stringify({ reply }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ reply: `⚠️ 系統錯誤：${e}` }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
