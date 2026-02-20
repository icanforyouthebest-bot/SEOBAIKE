// ===============================================================
// 小白秘書 v5 — 全系統全集團 + 輝達 NIM 直連
// 老闆專屬總部秘書長
// 整合：Supabase · GitHub · Cloudflare · NVIDIA NIM · Azure AD
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
const PROMPT = `你是「小白」，SEOBAIKE 系統數據報告助理。

你的工作是讀取即時系統數據，用繁體中文簡潔回報給用戶。

集團系統範圍：
• SEOBAIKE 主站 aiforseo.vip（專利 115100981）
• Empire AI Governance L1-L11 治理層
• NVIDIA 輝達集團 GPU AI 代理人
• Azure E5 + AD B2B 管理
• GitHub Actions CI/CD（SEOBAIKE + empire-ops）
• Cloudflare Workers 全球節點

回報格式：
- 繁體中文，5 行內，具體數字
- 直接報告系統狀態，不需詢問
- 有即時數據就用數據，沒有就說明`

// ── 偵測切換意圖 ──────────────────────────────────────────────
function detectSwitch(text: string): string | null {
  const lower = text.toLowerCase()
  if (!lower.includes('切換') && !lower.includes('switch') && !lower.includes('換')) return null
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (lower.includes(alias.toLowerCase())) return id
  }
  return null
}

// ── 偵測輝達直連意圖 ─────────────────────────────────────────
function detectNVIDIA(text: string): boolean {
  const lower = text.toLowerCase()
  const keywords = ['問輝達', '叫輝達', '輝達回答', '輝達說', '用nvidia', '用nim',
                    'ask nvidia', 'nvidia answer', '輝達你好', '你好輝達',
                    'nvidia:', 'nim:', '輝達:']
  return keywords.some(k => lower.includes(k))
}

// ── NVIDIA NIM 直連 ──────────────────────────────────────────
const NV_MODEL = 'meta/llama-3.3-70b-instruct'
const NV_URL   = 'https://integrate.api.nvidia.com/v1/chat/completions'

const NV_PROMPT = `你是 NVIDIA NIM 智能代理人，代號「輝達」，SEOBAIKE Empire AI 治理系統成員。
你擅長：GPU 運算、AI 模型推理、技術架構建議、數據分析。
請用繁體中文簡潔回答，5行內。直接進入重點。`

async function askNVIDIA(msg: string, data?: Record<string, unknown>): Promise<string> {
  if (!NV_KEY) return '⚠️ NVIDIA_API_KEY 未設定'
  const ctx = data ? `\n\n系統數據：${JSON.stringify(data, null, 2).slice(0, 800)}` : ''
  const res = await fetch(NV_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${NV_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: NV_MODEL,
      messages: [
        { role: 'system', content: NV_PROMPT },
        { role: 'user', content: `${msg}${ctx}` }
      ],
      max_tokens: 500,
      temperature: 0.7,
    })
  })
  const d = await res.json()
  if (!res.ok) return `⚠️ NVIDIA NIM 錯誤：${d.detail || res.status}`
  return `🟢 [輝達 NIM · ${NV_MODEL}]\n${d.choices?.[0]?.message?.content || '無回應'}`
}

// ── 查詢 NVIDIA NIM 可用模型 ─────────────────────────────────
async function qNVIDIAModels(): Promise<Record<string, unknown>> {
  if (!NV_KEY) return { error: 'no key' }
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { Authorization: `Bearer ${NV_KEY}` },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return { error: res.status }
    const d = await res.json()
    const models = (d.data || []).map((m: { id: string }) => m.id)
    return { total: models.length, sample: models.slice(0, 10) }
  } catch (e) { return { error: String(e) } }
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
      // 401/403 = protected but online (requires auth headers — expected)
      const isOnline = res.ok || res.status === 401 || res.status === 403
      results.push({ name: ep.name, status: isOnline ? 'online' : 'error', code: res.status })
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
    if (!res.ok) return { status: 'error', code: res.status }
    const d = await res.json()
    return { status: 'online', models: (d.data || []).length, active_model: NV_MODEL }
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
  // 1. 切換代理人
  const sw = detectSwitch(text)
  if (sw) {
    const result = await doSwitch(sb, sw)
    const { data: ag } = await sb.from('ai_agent_registry').select('agent_name').eq('status', 'active')
    const active = (ag || []).map((a: { agent_name: string }) => a.agent_name).join(', ')
    return `${result}\n✦ 現在活躍：${active}`
  }

  // 2. 輝達直連：直接讓 NVIDIA NIM 回答
  if (detectNVIDIA(text)) {
    const nvData = await qNVIDIA()
    const cleanQ = text.replace(/問輝達|叫輝達|輝達回答|輝達說|用nvidia|用nim|ask nvidia|nvidia:|nim:|輝達:|你好輝達|輝達你好/gi, '').trim()
    return await askNVIDIA(cleanQ || text, { nvidia_status: nvData })
  }

  // 3. 查詢輝達模型列表
  if (text.includes('輝達模型') || text.includes('nvidia模型') || text.includes('nim模型') || text.includes('有哪些模型')) {
    const models = await qNVIDIAModels()
    return await askClaude(text, { nvidia_models: models })
  }

  // 4. 一般系統查詢
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
