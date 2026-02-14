// ============================================================
// 訊息標準化 — 各平台 Webhook → NormalizedMessage
// ============================================================

import type { NormalizedMessage } from '../types'

// LINE
export function normalizeLine(body: any): NormalizedMessage | null {
  const event = body?.events?.[0]
  if (!event || event.type !== 'message' || event.message?.type !== 'text') return null

  return {
    source: 'line',
    source_user_id: event.source?.userId || '',
    platform_message_id: event.message.id,
    text: event.message.text,
    timestamp: new Date(event.timestamp).toISOString(),
    reply_token: event.replyToken,
  }
}

// Telegram
export function normalizeTelegram(body: any): NormalizedMessage | null {
  const msg = body?.message
  if (!msg?.text) return null

  return {
    source: 'telegram',
    source_user_id: String(msg.from?.id || ''),
    platform_message_id: String(msg.message_id),
    text: msg.text,
    timestamp: new Date(msg.date * 1000).toISOString(),
    chat_id: String(msg.chat?.id || ''),
  }
}

// WhatsApp
export function normalizeWhatsApp(body: any): NormalizedMessage | null {
  const entry = body?.entry?.[0]
  const change = entry?.changes?.[0]
  const msg = change?.value?.messages?.[0]
  if (!msg || msg.type !== 'text') return null

  return {
    source: 'whatsapp',
    source_user_id: msg.from,
    platform_message_id: msg.id,
    text: msg.text?.body || '',
    timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
    phone_number: msg.from,
  }
}

// Messenger
export function normalizeMessenger(body: any): NormalizedMessage | null {
  const entry = body?.entry?.[0]
  const event = entry?.messaging?.[0]
  if (!event?.message?.text) return null

  return {
    source: 'messenger',
    source_user_id: event.sender?.id || '',
    platform_message_id: event.message.mid,
    text: event.message.text,
    timestamp: new Date(event.timestamp).toISOString(),
    sender_id: event.sender?.id || '',
  }
}
