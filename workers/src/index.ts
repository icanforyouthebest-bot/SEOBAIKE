// ============================================================
// SEOBAIKE 遙控器 — AI Remote Control
// Cloudflare Workers AI (免費) + Telegram Inline Keyboard
// ============================================================

import type { Env, NormalizedMessage, ReplyContext } from './types'
import { normalizeLine, normalizeTelegram, normalizeWhatsApp, normalizeMessenger } from './middleware/normalizer'
import { normalizeDiscord } from './middleware/normalizer-discord'
import { normalizeSlack } from './middleware/normalizer-slack'
import { normalizeTeams } from './middleware/normalizer-teams'
import { normalizeEmail } from './middleware/normalizer-email'
import { normalizeGoogleChat } from './middleware/normalizer-google-chat'
import { normalizeWechat } from './middleware/normalizer-wechat'
import { normalizeSignal } from './middleware/normalizer-signal'
import { normalizeViber } from './middleware/normalizer-viber'
import { normalizeSms } from './middleware/normalizer-sms'
import { normalizeWebWidget } from './middleware/normalizer-web-widget'
import { verifyLine, verifyTelegram, verifyWhatsApp, verifyMessenger, verifyDiscord, verifySlack } from './middleware/signature-verify'
import { parseCommand } from './middleware/command-parser'
import { replyLine, pushLine } from './reply/line-reply'
import { replyTelegram, answerCallback, type TelegramReplyOptions } from './reply/telegram-reply'
import { replyWhatsApp } from './reply/whatsapp-reply'
import { replyMessenger } from './reply/messenger-reply'
import { replyDiscordInteraction, replyDiscordChannel } from './reply/discord-reply'
import { replySlack, pushSlackDM } from './reply/slack-reply'
import { replyTeams } from './reply/teams-reply'
import { replyEmail } from './reply/email-reply'
import { replyGoogleChat } from './reply/google-chat-reply'
import { replyWechat } from './reply/wechat-reply'
import { replySignal } from './reply/signal-reply'
import { replyViber } from './reply/viber-reply'
import { replySms } from './reply/sms-reply'
import { replyWebWidget } from './reply/web-widget-reply'
import { aiFormat, aiChat, aiConstrainedChat } from './ai/brain'
import { lookupAuth } from './middleware/auth'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // ── 真實頁面路由 → 從 GitHub 取 pages-site/*.html ──
    const SITE_PAGES: Record<string, string> = {
      '/': 'index.html',
      '/about': 'about.html',
      '/features': 'features.html',
      '/pricing': 'pricing.html',
      '/docs': 'docs.html',
      '/contact': 'contact.html',
      '/blog': 'blog.html',
      '/login': 'login.html',
      '/dashboard': 'dashboard.html',
      '/ecosystem': 'ecosystem.html',
    }
    const cleanPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
    const pageFile = SITE_PAGES[cleanPath]
    if (pageFile) {
      const rawRes = await fetch(`https://raw.githubusercontent.com/icanforyouthebest-bot/SEOBAIKE/master/pages-site/${pageFile}`)
      return new Response(rawRes.body, {
        status: rawRes.status,
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
      })
    }

    // ── 靜態資源 → 代理到 GitHub pages-site/ ──
    if (path.startsWith('/assets/') || path === '/favicon.svg' || path === '/favicon.ico' || path === '/og-image.png' || path === '/manifest.json' || path === '/seobaike-config.js' || path === '/seobaike-widget.js') {
      const assetFile = path.startsWith('/') ? path.slice(1) : path
      const rawRes = await fetch(`https://raw.githubusercontent.com/icanforyouthebest-bot/SEOBAIKE/master/pages-site/${assetFile}`)
      const contentType = path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.png') ? 'image/png' : path.endsWith('.ico') ? 'image/x-icon' : 'application/octet-stream'
      return new Response(rawRes.body, {
        status: rawRes.status,
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' },
      })
    }

    // ── 其他非 /api/ 路徑 → 404 真實回應（不再 fallback 到 Framer 空殼） ──
    if (!path.startsWith('/api/') && path !== '/api') {
      return new Response('<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>404 — SEOBAIKE</title><style>body{font-family:sans-serif;background:#0a0a1a;color:#eee;display:flex;justify-content:center;align-items:center;min-height:100vh;text-align:center;}h1{font-size:72px;color:#e8850c;margin-bottom:8px;}p{color:#888;}a{color:#76b900;}</style></head><body><div><h1>404</h1><p>頁面不存在</p><a href="/">回到首頁</a></div></body></html>', {
        status: 404,
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // CORS preflight — API 路徑統一處理
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

    if (path === '/api' || path === '/api/') return json(200, { status: 'ok', service: 'SEOBAIKE OS', version: '3.0.0', ai: 'cloudflare-workers-ai', platforms: 14, architecture: 'CaaS — 人類決策為主，AI 為輔助執行' })
    if (path === '/api/health') return json(200, { status: 'ok', timestamp: new Date().toISOString(), version: '3.0.0', platforms_ready: 14 })
    if (path === '/api/platforms') return json(200, PLATFORM_REGISTRY)

    // ── Pages 代理：生態系統儀表板 + Widget（從 GitHub Raw 取內容） ──
    const PAGES_MAP: Record<string, { file: string; type: string }> = {
      '/api/ecosystem': { file: 'pages-site/ecosystem.html', type: 'text/html; charset=utf-8' },
      '/api/widget.js': { file: 'pages-site/seobaike-widget.js', type: 'application/javascript; charset=utf-8' },
    }
    if (PAGES_MAP[path]) {
      const { file, type } = PAGES_MAP[path]
      const rawRes = await fetch(`https://raw.githubusercontent.com/icanforyouthebest-bot/SEOBAIKE/master/${file}`)
      return new Response(rawRes.body, {
        status: rawRes.status,
        headers: { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'public, max-age=600' },
      })
    }

    // ── /api/v1/* 公開資料路由 → 從 Supabase REST 代理 ──
    const SUPA_URL = env.SUPABASE_URL || 'https://vmyrivxxibqydccurxug.supabase.co'
    const SUPA_KEY = env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg'
    const supaHeaders = { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }

    if (path === '/api/v1/status') {
      return json(200, { status: 'operational', version: '3.0.0', patent: 'TW-115100981', timestamp: new Date().toISOString(), services: { workers: 'ok', supabase: 'ok', edge_functions: 'ok' } })
    }
    if (path === '/api/v1/nodes') {
      const [l1, l2, l3, l4] = await Promise.all([
        fetch(`${SUPA_URL}/rest/v1/l1_categories?select=id,code,name_zh,name_en`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
        fetch(`${SUPA_URL}/rest/v1/l2_subcategories?select=id,code,name_zh,name_en&limit=100`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
        fetch(`${SUPA_URL}/rest/v1/l3_processes?select=id,code,name_zh,name_en&limit=100`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
        fetch(`${SUPA_URL}/rest/v1/l4_nodes?select=id,code,name_zh,name_en&limit=100`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
      ])
      return json(200, { total: (l1 as any[]).length + (l2 as any[]).length + (l3 as any[]).length + (l4 as any[]).length, layers: { l1: (l1 as any[]).length, l2: (l2 as any[]).length, l3: (l3 as any[]).length, l4: (l4 as any[]).length } })
    }
    if (path === '/api/v1/l1') {
      const res = await fetch(`${SUPA_URL}/rest/v1/l1_categories?select=id,code,name_zh,name_en,tsic_code,naics_code,nace_code,jsic_code`, { headers: supaHeaders })
      const data = await res.json()
      return json(200, { count: (data as any[]).length, data })
    }
    if (path === '/api/v1/l2') {
      const limit = url.searchParams.get('limit') || '100'
      const res = await fetch(`${SUPA_URL}/rest/v1/l2_subcategories?select=id,code,name_zh,name_en,l1_id&limit=${limit}`, { headers: supaHeaders })
      const data = await res.json()
      return json(200, { count: (data as any[]).length, data })
    }
    if (path === '/api/v1/l3') {
      const limit = url.searchParams.get('limit') || '100'
      const res = await fetch(`${SUPA_URL}/rest/v1/l3_processes?select=id,code,name_zh,name_en,l2_id&limit=${limit}`, { headers: supaHeaders })
      const data = await res.json()
      return json(200, { count: (data as any[]).length, data })
    }
    if (path === '/api/v1/l4') {
      const limit = url.searchParams.get('limit') || '100'
      const res = await fetch(`${SUPA_URL}/rest/v1/l4_nodes?select=id,code,name_zh,name_en,l3_id&limit=${limit}`, { headers: supaHeaders })
      const data = await res.json()
      return json(200, { count: (data as any[]).length, data })
    }
    if (path === '/api/v1/check') {
      return json(200, { info: 'Use POST /api/v1/check with body {"l1":"code","l2":"code","l3":"code","l4":"code"} to validate inference path', method: 'POST', example: { l1: 'MFG', l2: 'SEMI', l3: 'ETCH', l4: 'PHOTO_RESIST' } })
    }
    if (path === '/api/v1/inference') {
      return json(200, { info: 'Use POST /api/v1/inference with body {"message":"your query","l4_node":"code"} to run constrained inference', method: 'POST' })
    }
    if (path === '/api/docs') {
      return Response.redirect(`${url.origin}/docs`, 301)
    }

    if (request.method === 'GET') {
      if (path === '/api/chat') {
        return new Response('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SEOBAIKE Chat</title></head><body style="margin:0;background:#0a0a1a;color:#eee;font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;"><div style="text-align:center;"><h1 style="color:#e8850c;">SEOBAIKE Chat</h1><p>請使用 <a href="/dashboard" style="color:#76b900;">/dashboard</a> 或 <a href="/api/ai/chat" style="color:#76b900;">API</a> 進行對話</p></div></body></html>', { status: 200, headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } })
      }
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
        case '/api/webhook/discord': return await handleDiscord(request, env)
        case '/api/webhook/slack': return await handleSlack(request, env)
        case '/api/webhook/teams': return await handleTeamsWebhook(request, env)
        case '/api/webhook/email': return await handleEmailWebhook(request, env)
        case '/api/webhook/google-chat': return await handleGoogleChatWebhook(request, env)
        case '/api/webhook/wechat': return await handleWechatWebhook(request, env)
        case '/api/webhook/signal': return await handleSignalWebhook(request, env)
        case '/api/webhook/viber': return await handleViberWebhook(request, env)
        case '/api/webhook/sms': return await handleSmsWebhook(request, env)
        case '/api/webhook/web-widget': return await handleWebWidgetWebhook(request, env)
        case '/api/gateway': return await handleGateway(request, env)
        case '/api/ai/chat': return await handleAiChat(request, env)
        case '/api/v1/check': {
          const body = await request.json() as any
          if (!body.l1_id && !body.l1_code) return json(400, { error: 'l1_id (uuid) or l1_code (e.g. L1-01) is required', example: { l1_code: 'L1-01', l4_code: 'L4-01010101' } })
          let l1Id = body.l1_id, l2Id = body.l2_id, l3Id = body.l3_id, l4Id = body.l4_id
          // 如果用 code 而不是 uuid，先查 ID
          if (body.l1_code && !l1Id) {
            const lookupRes = await fetch(`${SUPA_URL}/rest/v1/rpc/check_inference_path`, {
              method: 'POST', headers: { ...supaHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({ p_session_id: body.session_id || 'api-' + Date.now(), p_l1_id: null, p_l2_id: null, p_l3_id: null, p_l4_id: null, p_context: { l1_code: body.l1_code, l4_code: body.l4_code || null, source: 'api_v1_check' } })
            })
            if (lookupRes.ok) {
              const result = await lookupRes.json()
              return json(200, { patent: 'TW-115100981', method: 'check_inference_path()', path: { l1: body.l1_code, l2: body.l2_code, l3: body.l3_code, l4: body.l4_code }, result })
            }
          }
          // 直接用 UUID 呼叫
          const checkRes = await fetch(`${SUPA_URL}/rest/v1/rpc/check_inference_path`, {
            method: 'POST', headers: { ...supaHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_session_id: body.session_id || 'api-' + Date.now(), p_l1_id: l1Id || null, p_l2_id: l2Id || null, p_l3_id: l3Id || null, p_l4_id: l4Id || null, p_context: body.context || {} })
          })
          const result = checkRes.ok ? await checkRes.json() : { error: 'RPC call failed', status: checkRes.status }
          return json(200, { patent: 'TW-115100981', method: 'check_inference_path()', input: { l1_id: l1Id, l2_id: l2Id, l3_id: l3Id, l4_id: l4Id }, result })
        }
        case '/api/v1/inference': {
          const body = await request.json() as any
          if (!body.message) return json(400, { error: 'message is required' })
          const gwRes = await fetch(`${SUPA_URL}/functions/v1/ai-gateway`, {
            method: 'POST', headers: { ...supaHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: body.message, platform: 'api', platform_user_id: body.user_id || 'api-anonymous' })
          })
          const gwData = await gwRes.json()
          return json(gwRes.status, gwData)
        }
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
// Discord（Interaction webhook + Gateway relay）
// ============================================================
async function handleDiscord(request: Request, env: Env): Promise<Response> {
  // OS 就緒 — 等待遙控器連入
  if (!env.DISCORD_PUBLIC_KEY) return json(200, { status: 'os_ready', platform: 'discord', message: 'SEOBAIKE OS 就緒，Discord 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/discord' })

  // Ed25519 簽名驗證
  const isValid = await verifyDiscord(request, env)
  if (!isValid) return json(401, { error: 'Invalid signature' })

  const body = await request.json() as any

  // PING（Discord 驗證 endpoint 用，type=1）
  if (body.type === 1) {
    return json(200, { type: 1 })
  }

  // 標準化訊息
  const msg = normalizeDiscord(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)

  // 用戶身份查詢
  const auth = await lookupAuth(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, 'discord', msg.source_user_id)
  console.log(`[AUTH] discord:${msg.source_user_id} → ${auth.permission_level} (bound=${auth.is_bound})`)

  // Interaction 類型（type 2 或 3）需要用 Interaction 回覆
  const isInteraction = body.type === 2 || body.type === 3
  const interactionId = body.id
  const interactionToken = body.token

  // 非指令 → AI 約束式對話
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'discord', msg.source_user_id)
    const prefix = result.constrained && !result.allowed ? '>>> ' : result.industry ? `**${result.industry}**\n\n` : ''
    const replyText = prefix + result.reply

    if (isInteraction) {
      await replyDiscordInteraction(interactionId, interactionToken, replyText)
    } else if (msg.channel_id && env.DISCORD_BOT_TOKEN) {
      await replyDiscordChannel(msg.channel_id, replyText, env.DISCORD_BOT_TOKEN)
    }
    return json(200, { status: 'ok' })
  }

  // 審批閘門
  const approvalInfo = await checkRequiresApproval(env, parsed.command)
  if (approvalInfo.requires) {
    const queueResult = await callApprovalEdge(env, 'queue', {
      command: parsed.command,
      sub_command: parsed.sub_command,
      args: parsed.args,
      platform: 'discord',
      platform_user_id: msg.source_user_id,
      request_metadata: { source: 'discord', source_user_id: msg.source_user_id, session_id: `discord:${msg.source_user_id}:${Date.now()}` },
    })
    const pendingText = await aiFormat(env.AI, parsed.command, queueResult)

    if (isInteraction) {
      await replyDiscordInteraction(interactionId, interactionToken, pendingText)
    } else if (msg.channel_id && env.DISCORD_BOT_TOKEN) {
      await replyDiscordChannel(msg.channel_id, pendingText, env.DISCORD_BOT_TOKEN)
    }
    await sendApprovalNotification(env, queueResult, approvalInfo)
    return json(200, { status: 'queued_for_approval' })
  }

  // 指令 → SQL + AI 潤稿
  const result = await callEdge(env, parsed.command, msg.source_user_id, 'discord', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)

  if (isInteraction) {
    await replyDiscordInteraction(interactionId, interactionToken, replyText)
  } else if (msg.channel_id && env.DISCORD_BOT_TOKEN) {
    await replyDiscordChannel(msg.channel_id, replyText, env.DISCORD_BOT_TOKEN)
  }
  return json(200, { status: 'ok', result })
}

// ============================================================
// Slack（Events API）
// ============================================================
async function handleSlack(request: Request, env: Env): Promise<Response> {
  if (!env.SLACK_SIGNING_SECRET) return json(200, { status: 'os_ready', platform: 'slack', message: 'SEOBAIKE OS 就緒，Slack 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/slack' })

  // HMAC-SHA256 簽名驗證
  const isValid = await verifySlack(request, env)
  if (!isValid) return json(401, { error: 'Invalid signature' })

  const body = await request.json() as any

  // URL 驗證挑戰（Slack 設定 Events API 時的一次性驗證）
  if (body.type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 標準化訊息
  const msg = normalizeSlack(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  const botToken = env.SLACK_BOT_TOKEN
  const channelId = msg.channel_id

  // 用戶身份查詢
  const auth = await lookupAuth(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, 'slack', msg.source_user_id)
  console.log(`[AUTH] slack:${msg.source_user_id} → ${auth.permission_level} (bound=${auth.is_bound})`)

  // 非指令 → AI 約束式對話
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'slack', msg.source_user_id)
    const prefix = result.constrained && !result.allowed ? ':warning: ' : result.industry ? `*${result.industry}*\n\n` : ''
    const replyText = prefix + result.reply

    if (botToken && channelId) {
      await replySlack(channelId, replyText, botToken)
    }
    return json(200, { status: 'ok' })
  }

  // 審批閘門
  const approvalInfo = await checkRequiresApproval(env, parsed.command)
  if (approvalInfo.requires) {
    const queueResult = await callApprovalEdge(env, 'queue', {
      command: parsed.command,
      sub_command: parsed.sub_command,
      args: parsed.args,
      platform: 'slack',
      platform_user_id: msg.source_user_id,
      request_metadata: { source: 'slack', source_user_id: msg.source_user_id, session_id: `slack:${msg.source_user_id}:${Date.now()}` },
    })
    const pendingText = await aiFormat(env.AI, parsed.command, queueResult)

    if (botToken && channelId) {
      await replySlack(channelId, pendingText, botToken)
    }
    await sendApprovalNotification(env, queueResult, approvalInfo)
    return json(200, { status: 'queued_for_approval' })
  }

  // 指令 → SQL + AI 潤稿
  const result = await callEdge(env, parsed.command, msg.source_user_id, 'slack', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)

  if (botToken && channelId) {
    await replySlack(channelId, replyText, botToken)
  }
  return json(200, { status: 'ok', result })
}

// ============================================================
// Microsoft Teams
// ============================================================
async function handleTeamsWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.TEAMS_BOT_TOKEN) return json(200, { status: 'os_ready', platform: 'teams', message: 'SEOBAIKE OS 就緒，Teams 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/teams' })

  const body = await request.json() as any
  const msg = normalizeTeams(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  const serviceUrl = body.serviceUrl || ''
  const conversationId = body.conversation?.id || ''

  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'teams', msg.source_user_id)
    const prefix = result.constrained && !result.allowed ? '> ' : result.industry ? `**${result.industry}**\n\n` : ''
    if (serviceUrl && conversationId) await replyTeams(serviceUrl, conversationId, prefix + result.reply, env.TEAMS_BOT_TOKEN)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'teams', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (serviceUrl && conversationId) await replyTeams(serviceUrl, conversationId, replyText, env.TEAMS_BOT_TOKEN)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Email Webhook
// ============================================================
async function handleEmailWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.EMAIL_API_KEY) return json(200, { status: 'os_ready', platform: 'email', message: 'SEOBAIKE OS 就緒，Email 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/email' })

  const body = await request.json() as any
  const msg = normalizeEmail(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)

  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'email', msg.source_user_id)
    await replyEmail(msg.source_user_id, body.subject || 'SEOBAIKE AI', result.reply, env.EMAIL_API_KEY)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'email', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  await replyEmail(msg.source_user_id, body.subject || 'SEOBAIKE AI', replyText, env.EMAIL_API_KEY)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Google Chat
// ============================================================
async function handleGoogleChatWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CHAT_BOT_TOKEN) return json(200, { status: 'os_ready', platform: 'google_chat', message: 'SEOBAIKE OS 就緒，Google Chat 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/google-chat' })

  const body = await request.json() as any
  const msg = normalizeGoogleChat(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  const spaceName = body.space?.name || ''

  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'google_chat', msg.source_user_id)
    const prefix = result.constrained && !result.allowed ? '> ' : result.industry ? `*${result.industry}*\n\n` : ''
    if (spaceName) await replyGoogleChat(spaceName, prefix + result.reply, env.GOOGLE_CHAT_BOT_TOKEN)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'google_chat', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (spaceName) await replyGoogleChat(spaceName, replyText, env.GOOGLE_CHAT_BOT_TOKEN)
  return json(200, { status: 'ok', result })
}

// ============================================================
// WeChat 微信
// ============================================================
async function handleWechatWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.WECHAT_TOKEN) return json(200, { status: 'os_ready', platform: 'wechat', message: 'SEOBAIKE OS 就緒，WeChat 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/wechat' })

  const body = await request.text()
  const msg = normalizeWechat(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'wechat', msg.source_user_id)
    if (msg.open_id) await replyWechat(msg.open_id, result.reply, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'wechat', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (msg.open_id) await replyWechat(msg.open_id, replyText, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Signal
// ============================================================
async function handleSignalWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.SIGNAL_REST_API_URL) return json(200, { status: 'os_ready', platform: 'signal', message: 'SEOBAIKE OS 就緒，Signal 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/signal' })

  const body = await request.json() as any
  const msg = normalizeSignal(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'signal', msg.source_user_id)
    await replySignal(msg.source_user_id, result.reply, env.SIGNAL_BOT_NUMBER, env.SIGNAL_REST_API_URL)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'signal', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  await replySignal(msg.source_user_id, replyText, env.SIGNAL_BOT_NUMBER, env.SIGNAL_REST_API_URL)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Viber
// ============================================================
async function handleViberWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.VIBER_AUTH_TOKEN) return json(200, { status: 'os_ready', platform: 'viber', message: 'SEOBAIKE OS 就緒，Viber 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/viber' })

  const body = await request.json() as any
  const msg = normalizeViber(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'viber', msg.source_user_id)
    if (msg.viber_user_id) await replyViber(msg.viber_user_id, result.reply, env.VIBER_AUTH_TOKEN)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'viber', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (msg.viber_user_id) await replyViber(msg.viber_user_id, replyText, env.VIBER_AUTH_TOKEN)
  return json(200, { status: 'ok', result })
}

// ============================================================
// SMS (Twilio)
// ============================================================
async function handleSmsWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.TWILIO_AUTH_TOKEN) return json(200, { status: 'os_ready', platform: 'sms', message: 'SEOBAIKE OS 就緒，SMS 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/sms' })

  const body = await request.text()
  const msg = normalizeSms(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'sms', msg.source_user_id)
    if (msg.from_number) await replySms(msg.from_number, result.reply, env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_PHONE_NUMBER)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'sms', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (msg.from_number) await replySms(msg.from_number, replyText, env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_PHONE_NUMBER)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Web Widget 網頁聊天
// ============================================================
async function handleWebWidgetWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  const msg = normalizeWebWidget(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'web_widget', msg.source_user_id)
    // Web Widget 直接回 JSON，不走 callback
    return json(200, { status: 'ok', reply: result.reply, constrained: result.constrained, industry: result.industry })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'web_widget', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  return json(200, { status: 'ok', reply: replyText, result })
}

// ============================================================
// 主選單
// ============================================================
function mainMenu(): TelegramReplyOptions {
  return {
    text: '嗨，我是 SEOBAIKE — 你的 AI 管理助手。\n\n輕觸按鈕，或直接打字問我任何問題。',
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
  // OS 就緒 — 未設定 secret 時回應就緒狀態
  const secrets: Record<string, string | undefined> = { line: env.LINE_CHANNEL_SECRET, whatsapp: env.WHATSAPP_ACCESS_TOKEN, messenger: env.MESSENGER_APP_SECRET }
  if (!secrets[platform]) return json(200, { status: 'os_ready', platform, message: `SEOBAIKE OS 就緒，${platform} 遙控器等待連入`, webhook: `https://api.aiforseo.vip/api/webhook/${platform}` })
  const verifiers = { line: verifyLine, whatsapp: verifyWhatsApp, messenger: verifyMessenger }
  const isValid = await verifiers[platform](request, env)
  if (!isValid) return json(401, { error: 'Invalid signature' })
  const body = await request.json()
  const normalizers = { line: normalizeLine, whatsapp: normalizeWhatsApp, messenger: normalizeMessenger }
  const msg = normalizers[platform](body)
  if (!msg) return json(200, { status: 'ignored' })
  const parsed = parseCommand(msg.text)
  const replyCtx: ReplyContext = { source: platform, reply_token: msg.reply_token, chat_id: msg.chat_id, phone_number: msg.phone_number, sender_id: msg.sender_id }

  // 用戶身份查詢（接上 auth 中介層）
  const auth = await lookupAuth(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, platform, msg.source_user_id)
  console.log(`[AUTH] ${platform}:${msg.source_user_id} → ${auth.permission_level} (bound=${auth.is_bound})`)

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
    case 'discord': { if (ctx.channel_id && env.DISCORD_BOT_TOKEN) await replyDiscordChannel(ctx.channel_id, text, env.DISCORD_BOT_TOKEN); break }
    case 'slack': { if (ctx.channel_id && env.SLACK_BOT_TOKEN) await replySlack(ctx.channel_id, text, env.SLACK_BOT_TOKEN); break }
    case 'teams': { if (ctx.service_url && ctx.chat_id && env.TEAMS_BOT_TOKEN) await replyTeams(ctx.service_url, ctx.chat_id, text, env.TEAMS_BOT_TOKEN); break }
    case 'email': { if (ctx.sender_id && env.EMAIL_API_KEY) await replyEmail(ctx.sender_id, ctx.email_subject || 'SEOBAIKE AI', text, env.EMAIL_API_KEY); break }
    case 'google_chat': { if (ctx.space_name && env.GOOGLE_CHAT_BOT_TOKEN) await replyGoogleChat(ctx.space_name, text, env.GOOGLE_CHAT_BOT_TOKEN); break }
    case 'wechat': { if (ctx.open_id && env.WECHAT_APP_ID) await replyWechat(ctx.open_id, text, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET); break }
    case 'signal': { if (env.SIGNAL_REST_API_URL) await replySignal(ctx.sender_id || '', text, env.SIGNAL_BOT_NUMBER, env.SIGNAL_REST_API_URL); break }
    case 'viber': { if (ctx.viber_user_id && env.VIBER_AUTH_TOKEN) await replyViber(ctx.viber_user_id, text, env.VIBER_AUTH_TOKEN); break }
    case 'sms': { if (ctx.from_number && env.TWILIO_AUTH_TOKEN) await replySms(ctx.from_number, text, env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_PHONE_NUMBER); break }
    case 'web_widget': { if (ctx.callback_url) await replyWebWidget(ctx.callback_url, text, ctx.session_token); break }
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
  } else if (platform === 'discord' && chatId && env.DISCORD_BOT_TOKEN) {
    await replyDiscordChannel(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, env.DISCORD_BOT_TOKEN)
  } else if (platform === 'slack' && chatId && env.SLACK_BOT_TOKEN) {
    await replySlack(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, env.SLACK_BOT_TOKEN)
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
    '— SEOBAIKE AI',
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
  } else if (platform === 'discord' && env.DISCORD_BOT_TOKEN) {
    // Discord: platformUserId 在此情境是 channel_id（審批通知發送到頻道）
    await replyDiscordChannel(platformUserId, text, env.DISCORD_BOT_TOKEN)
  } else if (platform === 'slack' && env.SLACK_BOT_TOKEN) {
    // Slack: 使用 DM 通知請求者
    await pushSlackDM(platformUserId, text, env.SLACK_BOT_TOKEN)
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
// ============================================================
// 14 平台登錄表
// ============================================================
const PLATFORM_REGISTRY = {
  os: 'SEOBAIKE OS v3.0.0',
  patent: '115100981',
  company: '小路光有限公司',
  total_platforms: 14,
  platforms: [
    { id: 'telegram', name: 'Telegram', status: 'connected', webhook: '/api/webhook/telegram' },
    { id: 'line', name: 'LINE', status: 'os_ready', webhook: '/api/webhook/line' },
    { id: 'whatsapp', name: 'WhatsApp', status: 'os_ready', webhook: '/api/webhook/whatsapp' },
    { id: 'messenger', name: 'Messenger', status: 'os_ready', webhook: '/api/webhook/messenger' },
    { id: 'discord', name: 'Discord', status: 'os_ready', webhook: '/api/webhook/discord' },
    { id: 'slack', name: 'Slack', status: 'os_ready', webhook: '/api/webhook/slack' },
    { id: 'teams', name: 'Microsoft Teams', status: 'os_ready', webhook: '/api/webhook/teams' },
    { id: 'email', name: 'Email', status: 'os_ready', webhook: '/api/webhook/email' },
    { id: 'google_chat', name: 'Google Chat', status: 'os_ready', webhook: '/api/webhook/google-chat' },
    { id: 'wechat', name: 'WeChat 微信', status: 'os_ready', webhook: '/api/webhook/wechat' },
    { id: 'signal', name: 'Signal', status: 'os_ready', webhook: '/api/webhook/signal' },
    { id: 'viber', name: 'Viber', status: 'os_ready', webhook: '/api/webhook/viber' },
    { id: 'sms', name: 'SMS (Twilio)', status: 'os_ready', webhook: '/api/webhook/sms' },
    { id: 'web_widget', name: 'Web Widget', status: 'os_ready', webhook: '/api/webhook/web-widget' },
  ],
}

// 全站安全標頭 — 針對 HTML 頁面（proxy 到 origin 的回應）
const SITE_SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-XSS-Protection': '1; mode=block',
}

// API 安全標頭 — 針對 JSON API 回應
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://aiforseo.vip',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

function json(status: number, data: any): Response {
  return new Response(JSON.stringify(data), { status, headers: SECURITY_HEADERS })
}
