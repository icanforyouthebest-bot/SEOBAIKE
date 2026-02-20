// ===============================================================
// 小白秘書 — Empire AI Secretary Bot
// 老闆專屬 AI 秘書，整合所有系統
// Telegram + Anthropic Claude API + 全系統存取
// ===============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN  = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY')!
const FOUNDER_CHAT_ID     = Deno.env.get('TELEGRAM_CHAT_ID')!  // only respond to founder

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `你是「小白」，Empire AI Governance 系統的專屬秘書。
你只服務創辦人。你有以下能力：

1. 查看系統狀態：governance_audit_log, ai_agent_registry
2. 查看合規分數：hourly-compliance-score 最新記錄
3. 查看 GitHub Actions 執行狀態
4. 執行指令：切換AI代理人、邀請營運長、觸發報告
5. 解釋任何治理事件

你的回答：
- 繁體中文
- 簡潔直接，不廢話
- 數字和狀態必須從系統查詢，不能捏造
- 如果問題需要執行動作，說明要執行什麼並確認

系統概覽：
- SEOBAIKE: AI 市場平台
- empire-ops: 治理中心
- 治理層：L1-L11 全自動運作
- 審計：WORM 不可刪除
- 切換 AI：POST /functions/v1/switch-agent`

async function querySupabase(supabase: ReturnType<typeof createClient>, intent: string) {
  const results: Record<string, unknown> = {}

  // Always get latest compliance score
  const { data: score } = await supabase.from('governance_audit_log')
    .select('status, detail, created_at')
    .eq('check_name', 'hourly-compliance-score')
    .order('created_at', { ascending: false })
    .limit(1)
  results.compliance = score?.[0] || null

  // Recent critical events
  const { data: critical } = await supabase.from('governance_audit_log')
    .select('check_name, status, detail, source, created_at')
    .in('severity', ['critical', 'high'])
    .order('created_at', { ascending: false })
    .limit(5)
  results.critical_events = critical || []

  // Active AI agents
  if (intent.includes('切換') || intent.includes('agent') || intent.includes('AI') || intent.includes('代理')) {
    const { data: agents } = await supabase.from('ai_agent_registry')
      .select('agent_name, status, owner_org').order('status')
    results.agents = agents || []
  }

  // Recent blocked actions
  if (intent.includes('封鎖') || intent.includes('blocked') || intent.includes('安全')) {
    const { data: blocked } = await supabase.from('governance_audit_log')
      .select('check_name, detail, created_at')
      .eq('status', 'BLOCKED')
      .order('created_at', { ascending: false })
      .limit(5)
    results.blocked_actions = blocked || []
  }

  // Patrol summary
  const { data: patrol } = await supabase.from('governance_audit_log')
    .select('status, detail, created_at')
    .eq('check_name', 'patrol-summary')
    .order('created_at', { ascending: false })
    .limit(1)
  results.last_patrol = patrol?.[0] || null

  // Record counts last hour
  const hourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count } = await supabase.from('governance_audit_log')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', hourAgo)
  results.events_last_hour = count || 0

  return results
}

async function askClaude(userMessage: string, systemData: Record<string, unknown>): Promise<string> {
  const dataContext = JSON.stringify(systemData, null, 2)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `老闆問：${userMessage}\n\n系統即時數據：\n${dataContext}`
      }]
    })
  })

  const data = await response.json()
  return data.content?.[0]?.text || '系統暫時無法回應，請稍後再試。'
}

async function sendTelegram(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /**/ }

  // ── Telegram webhook ───────────────────────────────────────
  if (body.message) {
    const msg     = body.message as Record<string, unknown>
    const chatId  = String((msg.chat as Record<string, unknown>)?.id || '')
    const text    = String(msg.text || '')
    const userId  = String((msg.from as Record<string, unknown>)?.id || '')

    // Only respond to founder
    if (FOUNDER_CHAT_ID && chatId !== FOUNDER_CHAT_ID) {
      await sendTelegram(chatId, '⛔ 未授權。此秘書只服務創辦人。')
      return new Response('OK', { headers: corsHeaders })
    }

    try {
      // Show typing indicator
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
      })

      // Query system data
      const systemData = await querySupabase(supabase, text)

      // Ask Claude
      const reply = await askClaude(text, systemData)

      await sendTelegram(chatId, reply)

      // Log to WORM
      await supabase.from('governance_audit_log').insert({
        layer: 'SecretaryBot', check_name: 'secretary-query',
        status: 'OK', action: 'QUERY',
        detail: `founder_query=${text.substring(0, 100)}`,
        severity: 'info', source: 'secretary-bot'
      })
    } catch (e) {
      await sendTelegram(chatId, `⚠️ 系統錯誤：${e}`)
    }

    return new Response('OK', { headers: corsHeaders })
  }

  // ── Direct API call ────────────────────────────────────────
  const question = (body.question as string) || '系統狀態如何？'
  const systemData = await querySupabase(supabase, question)
  const reply = await askClaude(question, systemData)

  return new Response(JSON.stringify({ reply, system_data: systemData }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
