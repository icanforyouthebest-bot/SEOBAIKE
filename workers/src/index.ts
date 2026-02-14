// ============================================================
// BAIKE 萬能遙控器 — Physical AI Remote Control
// Cloudflare Workers AI (免費) + Telegram Inline Keyboard
// ============================================================

import type { Env, NormalizedMessage, ReplyContext } from './types'
import { normalizeLine, normalizeTelegram, normalizeWhatsApp, normalizeMessenger } from './middleware/normalizer'
import { verifyLine, verifyTelegram, verifyWhatsApp, verifyMessenger } from './middleware/signature-verify'
import { parseCommand } from './middleware/command-parser'
import { replyLine, pushLine } from './reply/line-reply'
import { replyTelegram, answerCallback, type TelegramReplyOptions } from './reply/telegram-reply'
import { replyWhatsApp } from './reply/whatsapp-reply'
import { replyMessenger } from './reply/messenger-reply'
import { aiFormat, aiChat, aiConstrainedChat } from './ai/brain'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS preflight — 所有路徑統一處理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...SECURITY_HEADERS,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (path === '/') return json(200, { status: 'ok', service: 'BAIKE Remote Control', version: '2.0.0', ai: 'cloudflare-workers-ai' })
    if (path === '/health') return json(200, { status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' })

    if (request.method === 'GET') {
      if (path === '/api/compliance-badge') return await handleComplianceBadge(env, url)
      if (path === '/api/webhook/whatsapp') {
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')
        if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge, { status: 200, headers: SECURITY_HEADERS })
        return new Response('Forbidden', { status: 403, headers: SECURITY_HEADERS })
      }
      if (path === '/api/webhook/messenger') {
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')
        if (mode === 'subscribe' && token === env.MESSENGER_VERIFY_TOKEN) return new Response(challenge, { status: 200, headers: SECURITY_HEADERS })
        return new Response('Forbidden', { status: 403, headers: SECURITY_HEADERS })
      }
      return json(404, { error: 'Not found' })
    }

    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

    try {
      switch (path) {
        case '/api/webhook/line': return await handleWebhook(request, env, 'line')
        case '/api/webhook/telegram': return await handleTelegram(request, env)
        case '/api/webhook/whatsapp': return await handleWebhook(request, env, 'whatsapp')
        case '/api/webhook/messenger': return await handleWebhook(request, env, 'messenger')
        case '/api/gateway': return await handleGateway(request, env)
        case '/api/ai/chat': return await handleAiChat(request, env)
        default: return json(404, { error: 'Not found' })
      }
    } catch (err: any) {
      console.error('Worker error:', err)
      if (err instanceof SyntaxError) return json(400, { error: 'Invalid JSON body' })
      return json(500, { error: 'Internal error', message: err.message })
    }
  },
}

// ============================================================
// Telegram（按鈕 + AI 腦）
// ============================================================
async function handleTelegram(request: Request, env: Env): Promise<Response> {
  if (env.TELEGRAM_SECRET_TOKEN) {
    const isValid = await verifyTelegram(request, env)
    if (!isValid) return json(401, { error: 'Invalid signature' })
  }

  const body = await request.json() as any
  const botToken = env.TELEGRAM_BOT_TOKEN

  // callback_query：按鈕
  if (body.callback_query) {
    const cb = body.callback_query
    const chatId = String(cb.message?.chat?.id || '')
    const command = cb.data || ''
    const userId = String(cb.from?.id || '')

    if (botToken) await answerCallback(cb.id, botToken)

    if (command === '/start') {
      if (botToken && chatId) await replyTelegram(chatId, mainMenu(), botToken)
      return json(200, { status: 'ok' })
    }

    // 審批按鈕：approve:{queueId} / reject:{queueId}
    if (command.startsWith('approve:') || command.startsWith('reject:')) {
      const [action, queueId] = command.split(':')
      const result = await callApprovalEdge(env, action, {
        queue_id: queueId,
        platform: 'telegram',
        platform_user_id: userId,
      })
      const aiText = await aiFormat(env.AI, `/${action}`, result)
      if (botToken && chatId) {
        await replyTelegram(chatId, { text: aiText, buttons: [[{ text: '📋 待審批', callback_data: '/pending' }, { text: '🏠 主選單', callback_data: '/start' }]] }, botToken)
      }
      // 跨平台通知請求者
      if (result.requester_platform && result.requester_platform_user_id) {
        await notifyRequester(env, result, action)
      }
      return json(200, { status: 'ok' })
    }

    const result = await callEdge(env, command, userId, 'telegram')
    const aiText = await aiFormat(env.AI, command, result)

    if (botToken && chatId) {
      await replyTelegram(chatId, { text: aiText, buttons: quickButtons(command) }, botToken)
    }
    return json(200, { status: 'ok' })
  }

  // 一般訊息
  const msg = normalizeTelegram(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)

  if (parsed.command === '/start' || parsed.command === 'start') {
    if (botToken && msg.chat_id) await replyTelegram(msg.chat_id, mainMenu(), botToken)
    return json(200, { status: 'ok' })
  }

  // 非指令 → AI 約束式對話（經 L1-L4 行業約束閘道）
  if (!parsed.command.startsWith('/')) {
    if (botToken && msg.chat_id) {
      const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'telegram', msg.source_user_id)
      const prefix = result.constrained && !result.allowed ? '⚠️ ' : result.industry ? `🔒 ${result.industry}\n\n` : ''
      await replyTelegram(msg.chat_id, { text: prefix + result.reply, buttons: [[{ text: '🏠 主選單', callback_data: '/start' }]] }, botToken)
    }
    return json(200, { status: 'ok' })
  }

  // 審批閘門：需要老闆核准的指令不直接執行
  const approvalInfo = await checkRequiresApproval(env, parsed.command)
  if (approvalInfo.requires) {
    const queueResult = await callApprovalEdge(env, 'queue', {
      command: parsed.command,
      sub_command: parsed.sub_command,
      args: parsed.args,
      platform: 'telegram',
      platform_user_id: msg.source_user_id,
      request_metadata: { source: 'telegram', source_user_id: msg.source_user_id, session_id: `telegram:${msg.source_user_id}:${Date.now()}` },
    })
    const pendingText = await aiFormat(env.AI, parsed.command, queueResult)
    if (botToken && msg.chat_id) {
      await replyTelegram(msg.chat_id, { text: pendingText, buttons: [[{ text: '🏠 主選單', callback_data: '/start' }]] }, botToken)
    }
    // 通知老闆（含完整解釋）
    await sendApprovalNotification(env, queueResult, approvalInfo)
    return json(200, { status: 'queued_for_approval' })
  }

  // 指令 → SQL + AI 潤稿
  const result = await callEdge(env, parsed.command, msg.source_user_id, 'telegram', parsed.sub_command, parsed.args)
  const aiText = await aiFormat(env.AI, parsed.command, result)

  if (botToken && msg.chat_id) {
    await replyTelegram(msg.chat_id, { text: aiText, buttons: quickButtons(parsed.command) }, botToken)
  }
  return json(200, { status: 'ok', result })
}

// ============================================================
// 主選單
// ============================================================
function mainMenu(): TelegramReplyOptions {
  return {
    text: '嗨，我是 BAIKE — 你的 AI 管理助手。\n\n輕觸按鈕，或直接打字問我任何問題。',
    buttons: [
      [{ text: '📊 系統狀態', callback_data: '/status' }, { text: '💰 今日營收', callback_data: '/revenue' }],
      [{ text: '🔍 SEO 分析', callback_data: '/seo' }, { text: '🏷 關鍵字', callback_data: '/keywords' }],
      [{ text: '👤 我的資訊', callback_data: '/me' }, { text: '🎯 點數', callback_data: '/points' }],
      [{ text: '👥 用戶管理', callback_data: '/users' }, { text: '📋 合規查詢', callback_data: '/compliance' }],
      [{ text: '🏭 產業分類', callback_data: '/l1' }, { text: '🔐 綁定帳號', callback_data: '/bind' }],
      [{ text: '📋 待審批', callback_data: '/pending' }, { text: '❓ 幫助', callback_data: '/help' }],
    ],
  }
}

function quickButtons(cmd: string): { text: string, callback_data: string }[][] {
  const h = { text: '🏠 主選單', callback_data: '/start' }
  const s = { text: '📊 狀態', callback_data: '/status' }
  const r = { text: '💰 營收', callback_data: '/revenue' }
  const e = { text: '🔍 SEO', callback_data: '/seo' }
  if (cmd === '/status') return [[r, e], [h]]
  if (cmd === '/revenue') return [[s, e], [h]]
  if (cmd === '/seo' || cmd === '/keywords') return [[s, r], [h]]
  return [[s, r], [h]]
}

// ============================================================
// Edge Function
// ============================================================
async function callEdge(env: Env, command: string, userId: string, source: string, sub_command?: string | null, args?: any): Promise<any> {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/remote-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ command, userId, metadata: { source, source_user_id: userId, session_id: `${source}:${userId}:${Date.now()}`, sub_command: sub_command || null, args: args || {} } }),
  })
  return res.json()
}

// ============================================================
// 其他平台
// ============================================================
async function handleWebhook(request: Request, env: Env, platform: 'line' | 'whatsapp' | 'messenger'): Promise<Response> {
  // 強制 signature 驗證 — 未設定 secret 時拒絕請求（不允許 bypass）
  const secrets: Record<string, string | undefined> = { line: env.LINE_CHANNEL_SECRET, whatsapp: env.WHATSAPP_ACCESS_TOKEN, messenger: env.MESSENGER_APP_SECRET }
  if (!secrets[platform]) return json(503, { error: `${platform} webhook not configured` })
  const verifiers = { line: verifyLine, whatsapp: verifyWhatsApp, messenger: verifyMessenger }
  const isValid = await verifiers[platform](request, env)
  if (!isValid) return json(401, { error: 'Invalid signature' })
  const body = await request.json()
  const normalizers = { line: normalizeLine, whatsapp: normalizeWhatsApp, messenger: normalizeMessenger }
  const msg = normalizers[platform](body)
  if (!msg) return json(200, { status: 'ignored' })
  const parsed = parseCommand(msg.text)
  const replyCtx: ReplyContext = { source: platform, reply_token: msg.reply_token, chat_id: msg.chat_id, phone_number: msg.phone_number, sender_id: msg.sender_id }

  // 審批閘門
  const approvalInfo = await checkRequiresApproval(env, parsed.command)
  if (approvalInfo.requires) {
    const queueResult = await callApprovalEdge(env, 'queue', {
      command: parsed.command,
      sub_command: parsed.sub_command,
      args: parsed.args,
      platform,
      platform_user_id: msg.source_user_id,
      request_metadata: { source: platform, source_user_id: msg.source_user_id, session_id: `${platform}:${msg.source_user_id}:${Date.now()}` },
    })
    const pendingText = await aiFormat(env.AI, parsed.command, queueResult)
    try { await sendReply(env, replyCtx, pendingText) } catch (e) { console.error('Reply failed:', e) }
    await sendApprovalNotification(env, queueResult, approvalInfo)
    return json(200, { status: 'queued_for_approval' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, platform, parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  try { await sendReply(env, replyCtx, replyText) } catch (e) { console.error('Reply failed:', e) }
  return json(200, { status: 'ok', result })
}

async function handleGateway(request: Request, env: Env): Promise<Response> {
  // Gateway 認證 — 必須帶 Authorization header
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return json(401, { error: 'Unauthorized' })
  }
  let body: any
  try { body = await request.json() } catch { return json(400, { error: 'Invalid JSON body' }) }
  if (!body.command) return json(400, { error: 'command is required' })
  const result = await callEdge(env, body.command, body.userId || 'anonymous', 'web', body.sub_command, body.args)
  return json(200, result)
}

// ============================================================
// AI 約束聊天（L1-L4 行業約束 + NVIDIA NIM）
// ============================================================
async function handleAiChat(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  const { message, platform, platform_user_id } = body

  if (!message) return json(400, { error: 'message is required' })
  if (!platform_user_id) return json(400, { error: 'platform_user_id is required' })

  const result = await aiConstrainedChat(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    message,
    platform || 'web',
    platform_user_id
  )

  return json(200, result)
}

// ============================================================
// 工具
// ============================================================
async function fetchToken(env: Env, platform: string, tokenKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_platform_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': env.SUPABASE_SERVICE_ROLE_KEY },
      body: JSON.stringify({ p_platform: platform, p_token_key: tokenKey }),
    })
    const parsed = await res.json()
    return parsed || null
  } catch { return null }
}

async function sendReply(env: Env, ctx: ReplyContext, text: string): Promise<void> {
  switch (ctx.source) {
    case 'line': { const token = env.LINE_CHANNEL_ACCESS_TOKEN || await fetchToken(env, 'line', 'channel_access_token'); if (ctx.reply_token && token) await replyLine(ctx.reply_token, text, token); break }
    case 'whatsapp': { const pid = env.WHATSAPP_PHONE_NUMBER_ID || await fetchToken(env, 'whatsapp', 'phone_number_id'); const token = env.WHATSAPP_ACCESS_TOKEN || await fetchToken(env, 'whatsapp', 'access_token'); if (ctx.phone_number && pid && token) await replyWhatsApp(ctx.phone_number, text, pid, token); break }
    case 'messenger': { const token = env.MESSENGER_PAGE_ACCESS_TOKEN || await fetchToken(env, 'messenger', 'page_access_token'); if (ctx.sender_id && token) await replyMessenger(ctx.sender_id, text, token); break }
  }
}

// ============================================================
// 審批系統
// ============================================================
async function callApprovalEdge(env: Env, action: string, params: Record<string, any>): Promise<any> {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/boss-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ action, ...params }),
  })
  return res.json()
}

interface ApprovalInfo {
  requires: boolean
  description_zh?: string
  risk_level?: string
  impact_description_zh?: string
}

async function checkRequiresApproval(env: Env, command: string): Promise<ApprovalInfo> {
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/remote_command_templates?command=eq.${encodeURIComponent(command)}&select=requires_confirmation,description_zh,risk_level,impact_description_zh&limit=1`,
      { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
    )
    const data = await res.json() as any[]
    if (data?.[0]?.requires_confirmation) {
      return {
        requires: true,
        description_zh: data[0].description_zh,
        risk_level: data[0].risk_level,
        impact_description_zh: data[0].impact_description_zh,
      }
    }
    return { requires: false }
  } catch {
    return { requires: false }
  }
}

async function sendApprovalNotification(env: Env, queueResult: any, approvalInfo: ApprovalInfo): Promise<void> {
  if (queueResult.error) return

  const platform = queueResult.approver_platform
  const chatId = queueResult.approver_chat_id
  const code = queueResult.approval_code
  const queueId = queueResult.queue_id

  const riskIcon = queueResult.risk_icon || '🟢 低風險'
  const lines = [
    `📋 審批請求 [${riskIcon}]`,
    '',
    `指令：${queueResult.command}`,
    `說明：${queueResult.description_zh || approvalInfo.description_zh || ''}`,
    `影響：${queueResult.impact_description_zh || approvalInfo.impact_description_zh || '無特殊影響'}`,
  ]

  if (queueResult.sub_command) lines.push(`參數：${queueResult.sub_command} ${JSON.stringify(queueResult.args || {})}`)
  lines.push(`請求者：${queueResult.requester_name || '未知'} (${queueResult.requester_platform || ''})`)
  lines.push(`審批碼：${code}`)
  lines.push(`⏰ ${queueResult.expires_minutes || 30} 分鐘內有效`)

  const text = lines.join('\n')

  if (platform === 'telegram' && chatId && env.TELEGRAM_BOT_TOKEN) {
    await replyTelegram(chatId, {
      text,
      buttons: [
        [
          { text: '✅ 核准', callback_data: `approve:${queueId}` },
          { text: '❌ 拒絕', callback_data: `reject:${queueId}` },
        ],
        [{ text: '📋 所有待審批', callback_data: '/pending' }],
      ],
    }, env.TELEGRAM_BOT_TOKEN)
  } else if (platform === 'line') {
    const lineToken = env.LINE_CHANNEL_ACCESS_TOKEN || await fetchToken(env, 'line', 'channel_access_token')
    if (chatId && lineToken) {
      await pushLine(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, lineToken)
    }
  } else if (platform === 'whatsapp' && chatId) {
    const pid = env.WHATSAPP_PHONE_NUMBER_ID || await fetchToken(env, 'whatsapp', 'phone_number_id')
    const token = env.WHATSAPP_ACCESS_TOKEN || await fetchToken(env, 'whatsapp', 'access_token')
    if (pid && token) {
      const { replyWhatsApp } = await import('./reply/whatsapp-reply')
      await replyWhatsApp(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, pid, token)
    }
  } else if (platform === 'messenger' && chatId) {
    const token = env.MESSENGER_PAGE_ACCESS_TOKEN || await fetchToken(env, 'messenger', 'page_access_token')
    if (token) {
      const { replyMessenger } = await import('./reply/messenger-reply')
      await replyMessenger(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, token)
    }
  }
}

async function notifyRequester(env: Env, approvalResult: any, action: string): Promise<void> {
  const platform = approvalResult.requester_platform
  const platformUserId = approvalResult.requester_platform_user_id
  if (!platform || !platformUserId) return

  const status = action === 'approve' ? '✅ 已核准' : '❌ 已拒絕'
  const text = [
    status,
    `指令：${approvalResult.command}`,
    approvalResult.result?.message || approvalResult.reason || '',
    '',
    '— BAIKE AI',
  ].join('\n')

  if (platform === 'telegram' && env.TELEGRAM_BOT_TOKEN) {
    await replyTelegram(platformUserId, { text, buttons: [[{ text: '🏠 主選單', callback_data: '/start' }]] }, env.TELEGRAM_BOT_TOKEN)
  } else if (platform === 'line') {
    const lineToken = env.LINE_CHANNEL_ACCESS_TOKEN || await fetchToken(env, 'line', 'channel_access_token')
    if (lineToken) await pushLine(platformUserId, text, lineToken)
  } else if (platform === 'whatsapp') {
    const pid = env.WHATSAPP_PHONE_NUMBER_ID || await fetchToken(env, 'whatsapp', 'phone_number_id')
    const token = env.WHATSAPP_ACCESS_TOKEN || await fetchToken(env, 'whatsapp', 'access_token')
    if (pid && token) {
      const { replyWhatsApp } = await import('./reply/whatsapp-reply')
      await replyWhatsApp(platformUserId, text, pid, token)
    }
  } else if (platform === 'messenger') {
    const token = env.MESSENGER_PAGE_ACCESS_TOKEN || await fetchToken(env, 'messenger', 'page_access_token')
    if (token) {
      const { replyMessenger } = await import('./reply/messenger-reply')
      await replyMessenger(platformUserId, text, token)
    }
  }
}

// ============================================================
// 合規徽章（Framer 嵌入用，預設開啟）
// ============================================================
async function handleComplianceBadge(env: Env, url: URL): Promise<Response> {
  const format = url.searchParams.get('format') || 'svg'

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_compliance_badge_data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: '{}',
  })
  const data = await res.json() as any

  if (format === 'json') {
    return json(200, data)
  }

  // SVG badge — embeddable via <img> or <iframe> in Framer
  const score = data.score ?? 0
  const grade = data.grade ?? 'N/A'
  const color = data.badge_color ?? '#6b7280'
  const iso = data.iso_42001_score ?? 0

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="40" viewBox="0 0 280 40">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
  </defs>
  <rect width="280" height="40" rx="8" fill="url(#bg)"/>
  <rect x="170" width="110" height="40" rx="8" fill="${color}"/>
  <rect x="170" width="8" height="40" fill="${color}"/>
  <text x="14" y="25" fill="#e0e7ff" font-family="system-ui,sans-serif" font-size="13" font-weight="600">AI Compliance</text>
  <text x="100" y="25" fill="#a5b4fc" font-family="system-ui,sans-serif" font-size="11">ISO 42001</text>
  <text x="225" y="25" fill="#fff" font-family="system-ui,sans-serif" font-size="14" font-weight="700" text-anchor="middle">${score}/100 ${grade}</text>
</svg>`

  return new Response(svg, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

// ============================================================
// 工具
// ============================================================
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
}

function json(status: number, data: any): Response {
  return new Response(JSON.stringify(data), { status, headers: SECURITY_HEADERS })
}
