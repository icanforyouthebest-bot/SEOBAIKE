// ===============================================================
// 小白秘書 v4 — 全系統全集團 FINAL
// 老闆專屬總部秘書長
// 整合：Supabase · GitHub · Cloudflare · Azure AD · NVIDIA
//        SEOBAIKE · empire-ops · L1-L11 · 23 AI · 12 頻道
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── ENV ──────────────────────────────────────────────────────
const SB_URL    = Deno.env.get('SUPABASE_URL')!
const SB_SK     = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY'))!
const SB_ANON   = Deno.env.get('SUPABASE_ANON_KEY')!
const TG_TOKEN  = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TG_OWNER  = Deno.env.get('TELEGRAM_CHAT_ID')!
const AI_KEY    = (Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('CLAUDE_API_KEY'))!
const GH_TOKEN  = (Deno.env.get('GITHUB_TOKEN') || Deno.env.get('GITHUB_PAT'))!
const CF_TOKEN  = Deno.env.get('CLOUDFLARE_API_TOKEN')!
const CF_ACCT   = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!
const CF_ZONE   = Deno.env.get('CLOUDFLARE_ZONE_ID')!
const NV_KEY    = (Deno.env.get('NVIDIA_API_KEY') || Deno.env.get('NVIDIA_AZURE_KEY'))!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── 代理人別名對照 ────────────────────────────────────────────
const ALIASES: Record<string,string> = {
  '\u8f1d\u9054':'nvidia-nim','nvidia':'nvidia-nim','nim':'nvidia-nim','\u82f1\u5049\u9054':'nvidia-nim',
  'claude':'claude-code','anthropic':'claude-code',
  'openai':'openai-gpt4o','gpt':'openai-gpt4o','chatgpt':'openai-gpt4o',
  'groq':'groq-llama','llama':'groq-llama',
  'deepseek':'deepseek-r1','grok':'xai-grok','xai':'xai-grok',
  'mistral':'mistral','together':'together-ai',
  'perplexity':'perplexity','openrouter':'openrouter',
}

// ── SYSTEM PROMPT ────────────────────────────────────────────
const PROMPT = `\u4f60\u662f\u300c\u5c0f\u767d\u300d\uff0cEmpire AI \u5e1d\u570b\u7e3d\u90e8\u79d8\u66f8\u9577\u3002

\u96c6\u5718\u7248\u5716\uff1a
\u2022 \u5c0f\u8def\u5149\u6709\u9650\u516c\u53f8 / SEOBAIKE (\u4e3b\u7ad9 aiforseo.vip)
\u2022 Empire AI Governance (L1-L11 \u6cbb\u7406\u5c64)
\u2022 \u8f1d\u9054\u96c6\u5718 NVIDIA (\u4e3b\u529b GPU AI \u4ee3\u7406\u4eba)
\u2022 Azure E5 + AD B2B \u5916\u90e8\u7ba1\u7406
\u2022 GitHub Actions CI/CD (SEOBAIKE + empire-ops)
\u2022 Cloudflare Workers \u5168\u7403 300+ \u7bc0\u9ede
\u2022 \u5c08\u5229 115100981 \u00b7 \u7d71\u4e00\u7de8\u865f 60475510

\u898f\u5247\uff1a
1. \u8001\u95c6\u4e0b\u4ee4\u76f4\u63a5\u57f7\u884c\uff0c\u4e0d\u554f\u554f\u984c\u4e0d\u8981\u78ba\u8a8d
2. 5 \u884c\u5167\u7b80\u6f54\u5177\u9ad4\uff0c\u7e41\u9ad4\u4e2d\u6587
3. \u6578\u5b57\u5f9e\u5373\u6642\u7cfb\u7d71\u6578\u64da\u53d6\u5f97
4. \u5207\u63db/\u57f7\u884c\u5df2\u5b8c\u6210\u5c31\u76f4\u63a5\u5831\u544a\u7d50\u679c`

// ── 切換偵測 ──────────────────────────────────────────────────
function detectSwitch(t: string): string|null {
  const l = t.toLowerCase()
  if (!l.includes('\u5207\u63db') && !l.includes('switch') && !l.includes('\u63db')) return null
  for (const [a,id] of Object.entries(ALIASES)) if (l.includes(a.toLowerCase())) return id
  return null
}

// ── 執行切換 ──────────────────────────────────────────────────
async function doSwitch(sb: ReturnType<typeof createClient>, target: string): Promise<string> {
  try {
    await sb.from('ai_agent_registry')
      .update({ status:'suspended', suspend_reason:'\u8001\u95c6\u5207\u63db\u6307\u4ee4', suspended_at: new Date().toISOString() })
      .eq('agent_type','ai').eq('status','active').neq('agent_name', target)
    const { data: ex } = await sb.from('ai_agent_registry').select('id').eq('agent_name',target).maybeSingle()
    if (ex) {
      await sb.from('ai_agent_registry').update({ status:'active', suspended_at:null, suspend_reason:null }).eq('agent_name',target)
    } else {
      await sb.from('ai_agent_registry').insert({
        agent_name:target, agent_type:'ai', status:'active',
        owner_org: target.includes('nvidia') ? 'NVIDIA \u8f1d\u9054\u96c6\u5718' : 'SEOBAIKE',
        description:`${target} \u2014 \u8001\u95c6\u6307\u5b9a`
      })
    }
    await sb.from('governance_audit_log').insert({
      layer:'SecretaryBot', check_name:'agent-switch', status:'APPLIED', action:'SWITCH',
      detail:`founder_cmd: -> ${target}`, severity:'high', source:'secretary-bot'
    })
    return `\u2705 \u5df2\u5207\u63db\u5230 ${target}\n\u5df2\u5beb\u5165 WORM \u5be9\u8a08`
  } catch(e) { return `\u26a0\ufe0f \u5207\u63db\u5931\u6557\uff1a${e}` }
}

// ── Supabase 治理全查詢 ───────────────────────────────────────
async function qSupabase(sb: ReturnType<typeof createClient>, intent: string) {
  const r: Record<string,unknown> = {}

  // 合規分數
  const { data: sc } = await sb.from('governance_audit_log')
    .select('status,detail,created_at').eq('check_name','hourly-compliance-score')
    .order('created_at',{ascending:false}).limit(1)
  r.compliance = sc?.[0] || null

  // 關鍵事件 (L1-L11 全層)
  const { data: cr } = await sb.from('governance_audit_log')
    .select('layer,check_name,status,detail,severity,source,created_at')
    .in('severity',['critical','high']).order('created_at',{ascending:false}).limit(10)
  r.critical = cr || []

  // 所有代理人
  const { data: ag } = await sb.from('ai_agent_registry')
    .select('agent_name,status,owner_org,agent_type').order('status').order('agent_name')
  r.agents = ag || []

  // 巡邏
  const { data: pt } = await sb.from('governance_audit_log')
    .select('status,detail,created_at').eq('check_name','patrol-summary')
    .order('created_at',{ascending:false}).limit(1)
  r.patrol = pt?.[0] || null

  // 事件量
  const hourAgo = new Date(Date.now()-3600000).toISOString()
  const { count } = await sb.from('governance_audit_log')
    .select('*',{count:'exact',head:true}).gte('created_at',hourAgo)
  r.events_1h = count || 0

  // L1-L11 最新狀態
  const { data: layers } = await sb.from('governance_audit_log')
    .select('layer,check_name,status,created_at')
    .not('layer','is',null).order('created_at',{ascending:false}).limit(30)
  r.layers = layers || []

  // 封鎖記錄
  if (intent.includes('\u5c01\u9396')||intent.includes('block')||intent.includes('\u5b89\u5168')) {
    const { data: bl } = await sb.from('governance_audit_log')
      .select('check_name,detail,created_at').eq('status','BLOCKED')
      .order('created_at',{ascending:false}).limit(8)
    r.blocked = bl || []
  }

  // 最近操作記錄
  const { data: rec } = await sb.from('governance_audit_log')
    .select('check_name,status,action,detail,created_at')
    .order('created_at',{ascending:false}).limit(5)
  r.recent = rec || []

  return r
}

// ── GitHub Actions ────────────────────────────────────────────
async function qGitHub() {
  if (!GH_TOKEN) return {error:'no token'}
  const repos = ['icanforyouthebest-bot/SEOBAIKE','icanforyouthebest-bot/empire-ops']
  const out: unknown[] = []
  for (const repo of repos) {
    try {
      const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=5`,
        { headers:{ Authorization:`Bearer ${GH_TOKEN}`, Accept:'application/vnd.github.v3+json' } })
      if (!r.ok) { out.push({repo,error:r.status}); continue }
      const d = await r.json()
      out.push({ repo, runs: d.workflow_runs?.slice(0,5).map((w:{name:string,conclusion:string,status:string,created_at:string}) => ({
        name:w.name, result:w.conclusion||w.status, at:w.created_at.substring(0,16)
      })) })
    } catch(e) { out.push({repo,error:String(e)}) }
  }
  return { repos: out }
}

// ── Cloudflare ────────────────────────────────────────────────
async function qCloudflare() {
  if (!CF_TOKEN) return {error:'no token'}
  const results: Record<string,unknown> = {}
  try {
    // Workers
    const wr = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/workers/scripts`,
      { headers:{ Authorization:`Bearer ${CF_TOKEN}` } })
    if (wr.ok) { const d = await wr.json(); results.workers = d.result?.length || 0 }
    // Zone security (WAF rules)
    if (CF_ZONE) {
      const zr = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE}`,
        { headers:{ Authorization:`Bearer ${CF_TOKEN}` } })
      if (zr.ok) { const d = await zr.json(); results.zone = { name: d.result?.name, status: d.result?.status } }
    }
    results.status = 'online'
  } catch(e) { results.error = String(e) }
  return results
}

// ── SEOBAIKE 網站健康 ─────────────────────────────────────────
async function qSEOBAIKE() {
  const endpoints = [
    { name:'主站', url:'https://www.aiforseo.vip' },
    { name:'AI Gateway', url:`${SB_URL}/functions/v1/ai-governance-gateway` },
    { name:'CEO Dashboard', url:`${SB_URL}/functions/v1/ceo-dashboard` },
  ]
  const results = []
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep.url, { signal: AbortSignal.timeout(5000) })
      results.push({ name:ep.name, status:r.ok?'online':'error', code:r.status })
    } catch { results.push({ name:ep.name, status:'offline' }) }
  }
  return results
}

// ── NVIDIA 健康 ───────────────────────────────────────────────
async function qNVIDIA() {
  if (!NV_KEY) return { status:'no key' }
  try {
    const r = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers:{ Authorization:`Bearer ${NV_KEY}` },
      signal: AbortSignal.timeout(5000)
    })
    return { status: r.ok ? 'online' : 'error', code: r.status }
  } catch { return { status:'timeout' } }
}

// ── Claude Haiku ──────────────────────────────────────────────
async function askClaude(msg: string, data: Record<string,unknown>, action?: string): Promise<string> {
  const ctx = action ? `\u5df2\u57f7\u884c\uff1a${action}\n\n${JSON.stringify(data,null,2)}` : JSON.stringify(data,null,2)
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key':AI_KEY, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({
      model:'claude-haiku-4-5-20251001', max_tokens:500, system:PROMPT,
      messages:[{ role:'user', content:`\u8001\u95c6\uff1a${msg}\n\n\u7cfb\u7d71\u5373\u6642\u6578\u64da\uff1a\n${ctx}` }]
    })
  })
  const d = await r.json()
  return d.content?.[0]?.text || '\u7cfb\u7d71\u66ab\u6642\u7121\u6cd5\u56de\u61c9\u3002'
}

async function sendTG(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id:chatId, text, parse_mode:'Markdown' })
  })
}

// ── 主邏輯 ────────────────────────────────────────────────────
async function handle(sb: ReturnType<typeof createClient>, text: string): Promise<string> {
  // 切換指令 → 立即執行
  const sw = detectSwitch(text)
  if (sw) {
    const result = await doSwitch(sb, sw)
    const { data: ag } = await sb.from('ai_agent_registry').select('agent_name').eq('status','active')
    const active = (ag||[]).map((a:{agent_name:string}) => a.agent_name).join(', ')
    return `${result}\n\u2756 \u73fe\u5728\u6d3b\u8e8d\u4ee3\u7406\u4eba\uff1a${active}`
  }

  // 決定要查哪些系統
  const isFullStatus = text.includes('\u5168\u90e8')||text.includes('\u72c0\u614b')||text.includes('\u7e3d\u90e8')||text.length < 6
  const wantsNvidia  = text.includes('\u8f1d\u9054')||text.includes('nvidia')
  const wantsSite    = text.includes('\u7db2\u7ad9')||text.includes('\u5065\u5eb7')||text.includes('site')||isFullStatus
  const wantsGH      = text.includes('github')||text.includes('ci')||text.includes('\u90e8\u7f72')||isFullStatus
  const wantsCF      = text.includes('cloudflare')||text.includes('\u7bc0\u9ede')||isFullStatus

  // 並行查詢所有系統
  const [govData, ghData, cfData, siteData, nvData] = await Promise.all([
    qSupabase(sb, text),
    wantsGH ? qGitHub() : Promise.resolve(null),
    wantsCF ? qCloudflare() : Promise.resolve(null),
    wantsSite ? qSEOBAIKE() : Promise.resolve(null),
    wantsNvidia ? qNVIDIA() : Promise.resolve(null),
  ])

  const allData: Record<string,unknown> = { ...govData }
  if (ghData)   allData.github = ghData
  if (cfData)   allData.cloudflare = cfData
  if (siteData) allData.seobaike_health = siteData
  if (nvData)   allData.nvidia = nvData

  return await askClaude(text, allData)
}

// ── Deno Server ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const sb = createClient(SB_URL, SB_SK || SB_ANON)
  let body: Record<string,unknown> = {}
  try { body = await req.json() } catch { /**/ }

  // Telegram
  if (body.message) {
    const msg    = body.message as Record<string,unknown>
    const chatId = String((msg.chat as Record<string,unknown>)?.id || '')
    const text   = String(msg.text || '')
    if (TG_OWNER && chatId !== TG_OWNER) {
      await sendTG(chatId, '\u26d4 \u672a\u6388\u6b0a\u3002')
      return new Response('OK', { headers: CORS })
    }
    try {
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendChatAction`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ chat_id:chatId, action:'typing' })
      })
      const reply = await handle(sb, text)
      await sendTG(chatId, reply)
      await sb.from('governance_audit_log').insert({
        layer:'SecretaryBot', check_name:'secretary-query', status:'OK', action:'QUERY',
        detail:`q=${text.substring(0,100)}`, severity:'info', source:'secretary-bot'
      })
    } catch(e) { await sendTG(chatId, `\u26a0\ufe0f ${e}`) }
    return new Response('OK', { headers: CORS })
  }

  // Web widget
  const q = (body.question as string) || '\u5168\u90e8\u7cfb\u7d71\u72c0\u614b'
  try {
    const reply = await handle(sb, q)
    return new Response(JSON.stringify({ reply }), { headers:{...CORS,'Content-Type':'application/json'} })
  } catch(e) {
    return new Response(JSON.stringify({ reply:`\u26a0\ufe0f \u7cfb\u7d71\u932f\u8aa4\uff1a${e}` }), {
      headers:{...CORS,'Content-Type':'application/json'}
    })
  }
})
