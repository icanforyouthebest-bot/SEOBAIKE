// ===============================================================
// 小白秘書 — Empire AI Secretary Bot v2
// 老闆下令直接執行，不問廢話
// Telegram + Web Widget + Anthropic Claude + Supabase 全系統
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN  = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY')!
const FOUNDER_CHAT_ID     = Deno.env.get('TELEGRAM_CHAT_ID')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── 代理人名稱對照表 ──────────────────────────────────────────
const AGENT_ALIASES: Record<string, string> = {
  '輝達': 'nvidia-nim', 'nvidia': 'nvidia-nim', 'nim': 'nvidia-nim',
  'claude': 'anthropic-claude', 'anthropic': 'anthropic-claude',
  'openai': 'openai-gpt4o', 'gpt': 'openai-gpt4o', 'gpt4': 'openai-gpt4o',
  'groq': 'groq-llama', 'llama': 'groq-llama',
  'deepseek': 'deepseek-r1', 'grok': 'xai-grok', 'xai': 'xai-grok',
  'mistral': 'mistral', 'together': 'together-ai',
  'perplexity': 'perplexity', 'openrouter': 'openrouter',
}

const SYSTEM_PROMPT = `你是「小白」，Empire AI Governance 系統的專屬秘書。
你只服務創辦人。

重要規則：
- 老闆說什麼就執行什麼，不問問題，不要確認，直接告訴老闆結果
- 回答簡短有力，最多5行
- 繁體中文
- 數字從系統數據取，不能捏造
- 切換指令已由系統自動執行，你只需報告結果

系統概覽：
- SEOBAIKE: AI 市場平台，empire-ops: 治理中心
- 治理層：L1-L11 全自動運作，審計 WORM 不可刪除
- 合規分數每小時計算`

// ── 偵測切換意圖 ─────────────────────────────────────────────
function detectSwitchAgent(text: string): string | null {
  const lower = text.toLowerCase()
  if (!lower.includes('切換') && !lower.includes('switch') && !lower.includes('換')) return null
  for (const [alias, agentId] of Object.entries(AGENT_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) return agentId
  }
  return null
}

// ── 執行 AI 代理人切換 ────────────────────────────────────────
async function executeSwitch(supabase: ReturnType<typeof createClient>, newAgent: string): Promise<string> {
  try {
    // 取得目前 active 代理人
    const { data: current } = await supabase.from('ai_agent_registry')
      .select('agent_name').eq('status', 'active').neq('agent_name', newAgent)

    // 停用舊代理人
    if (current && current.length > 0) {
      await supabase.from('ai_agent_registry')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .neq('agent_name', newAgent)
        .eq('status', 'active')
    }

    // 啟用新代理人（如不存在則新增）
    const { data: existing } = await supabase.from('ai_agent_registry')
      .select('agent_name').eq('agent_name', newAgent).single()

    if (existing) {
      await supabase.from('ai_agent_registry')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('agent_name', newAgent)
    } else {
      await supabase.from('ai_agent_registry').insert({
        agent_name: newAgent, provider: newAgent.split('-')[0],
        model_id: newAgent, status: 'active', owner_org: 'SEOBAIKE',
        description: `${newAgent} — 老闆指定切換`
      })
    }

    // 寫入 WORM 審計
    await supabase.from('governance_audit_log').insert({
      layer: 'SecretaryBot', check_name: 'agent-switch',
      status: 'APPLIED', action: 'SWITCH',
      detail: `founder_switch: ${current?.map((c: {agent_name: string}) => c.agent_name).join(',') || 'none'} → ${newAgent}`,
      severity: 'high', source: 'secretary-bot'
    })

    const suspended = current?.map((c: {agent_name: string}) => c.agent_name).join(', ') || '無'
    return `✅ 已切換完成\n舊代理人：${suspended} → 停用\n新代理人：${newAgent} → 啟用\n已寫入 WORM 審計`
  } catch (e) {
    return `⚠️ 切換失敗：${e}`
  }
}

// ── 查詢 Supabase 系統數據 ────────────────────────────────────
async function querySupabase(supabase: ReturnType<typeof createClient>, intent: string) {
  const results: Record<string, unknown> = {}

  const { data: score } = await supabase.from('governance_audit_log')
    .select('status, detail, created_at')
    .eq('check_name', 'hourly-compliance-score')
    .order('created_at', { ascending: false }).limit(1)
  results.compliance = score?.[0] || null

  const { data: critical } = await supabase.from('governance_audit_log')
    .select('check_name, status, detail, source, created_at')
    .in('severity', ['critical', 'high'])
    .order('created_at', { ascending: false }).limit(5)
  results.critical_events = critical || []

  const { data: agents } = await supabase.from('ai_agent_registry')
    .select('agent_name, status, owner_org').order('status')
  results.agents = agents || []

  if (intent.includes('封鎖') || intent.includes('blocked')) {
    const { data: blocked } = await supabase.from('governance_audit_log')
      .select('check_name, detail, created_at').eq('status', 'BLOCKED')
      .order('created_at', { ascending: false }).limit(5)
    results.blocked_actions = blocked || []
  }

  const { data: patrol } = await supabase.from('governance_audit_log')
    .select('status, detail, created_at').eq('check_name', 'patrol-summary')
    .order('created_at', { ascending: false }).limit(1)
  results.last_patrol = patrol?.[0] || null

  const hourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count } = await supabase.from('governance_audit_log')
    .select('*', { count: 'exact', head: true }).gte('created_at', hourAgo)
  results.events_last_hour = count || 0

  return results
}

// ── 呼叫 Claude ───────────────────────────────────────────────
async function askClaude(userMessage: string, systemData: Record<string, unknown>, actionResult?: string): Promise<string> {
  const dataContext = JSON.stringify(systemData, null, 2)
  const content = actionResult
    ? `老闆問：${userMessage}\n\n系統已執行結果：${actionResult}\n\n系統即時數據：\n${dataContext}`
    : `老闆問：${userMessage}\n\n系統即時數據：\n${dataContext}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }]
    })
  })

  const data = await response.json()
  return data.content?.[0]?.text || '系統暫時無法回應。'
}

async function sendTelegram(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  })
}

// ── 主處理邏輯 ────────────────────────────────────────────────
async function handleMessage(supabase: ReturnType<typeof createClient>, text: string): Promise<string> {
  // 先檢查是否有切換指令 → 直接執行，不問
  const switchTarget = detectSwitchAgent(text)
  let actionResult: string | undefined

  if (switchTarget) {
    actionResult = await executeSwitch(supabase, switchTarget)
  }

  // 查詢系統數據
  const systemData = await querySupabase(supabase, text)

  // 如果是純切換指令，不需要問 Claude，直接回傳結果
  if (switchTarget && actionResult) {
    const agents = (systemData.agents as Array<{agent_name: string, status: string}>) || []
    const activeAgents = agents.filter(a => a.status === 'active').map(a => a.agent_name)
    return `${actionResult}\n\n現在活躍代理人：${activeAgents.join(', ') || switchTarget}`
  }

  // 一般查詢交給 Claude 處理
  return await askClaude(text, systemData, actionResult)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  // ── Telegram webhook ─────────────────────────────────────────
  if (body.message) {
    const msg    = body.message as Record<string, unknown>
    const chatId = String((msg.chat as Record<string, unknown>)?.id || '')
    const text   = String(msg.text || '')

    if (FOUNDER_CHAT_ID && chatId !== FOUNDER_CHAT_ID) {
      await sendTelegram(chatId, '⛔ 未授權。')
      return new Response('OK', { headers: corsHeaders })
    }

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
      })
      const reply = await handleMessage(supabase, text)
      await sendTelegram(chatId, reply)
      await supabase.from('governance_audit_log').insert({
        layer: 'SecretaryBot', check_name: 'secretary-query',
        status: 'OK', action: 'QUERY',
        detail: `q=${text.substring(0, 100)}`, severity: 'info', source: 'secretary-bot'
      })
    } catch (e) { await sendTelegram(chatId, `⚠️ 錯誤：${e}`) }

    return new Response('OK', { headers: corsHeaders })
  }

  // ── Web widget 直接呼叫 ───────────────────────────────────────
  const question = (body.question as string) || '系統狀態如何？'
  try {
    const reply = await handleMessage(supabase, question)
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ reply: `⚠️ 系統錯誤：${e}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
