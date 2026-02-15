// ============================================================
// Slack 訊息標準化 — Slack Events API → NormalizedMessage
// ============================================================

import type { NormalizedMessage } from '../types'

/**
 * 標準化 Slack Events API 事件
 * Slack 的 Events API 會發送：
 * - url_verification（挑戰驗證，由路由層處理）
 * - event_callback（實際事件）
 *
 * 支援的事件類型：
 * - message（頻道訊息）
 * - app_mention（@提及 bot）
 */
export function normalizeSlack(body: any): NormalizedMessage | null {
  // 只處理 event_callback
  if (body?.type !== 'event_callback') return null

  const event = body.event
  if (!event) return null

  // 忽略 bot 自己的訊息（避免無限迴圈）
  if (event.bot_id || event.subtype === 'bot_message') return null

  // 支援 message 和 app_mention 事件
  if (event.type !== 'message' && event.type !== 'app_mention') return null

  // 忽略子類型訊息（編輯、刪除、系統訊息等）
  // message 事件中 subtype 存在代表非一般使用者訊息
  if (event.type === 'message' && event.subtype) return null

  const text = event.text || ''
  if (!text.trim()) return null

  // 清除 Slack 的 mention 格式 <@U12345> → 保留純文字
  const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim()
  if (!cleanText) return null

  return {
    source: 'slack',
    source_user_id: event.user || '',
    platform_message_id: event.client_msg_id || event.ts || '',
    text: cleanText,
    timestamp: event.ts ? new Date(parseFloat(event.ts) * 1000).toISOString() : new Date().toISOString(),
    channel_id: event.channel || '',
  }
}
