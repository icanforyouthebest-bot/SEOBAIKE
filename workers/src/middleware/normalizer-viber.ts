// ============================================================
// Viber — Webhook 訊息標準化
// SEOBAIKE 萬能遙控器 — Viber Bot 平台
// ============================================================

import type { NormalizedMessage } from '../types'

/**
 * 解析 Viber Bot webhook 推送的訊息
 *
 * Viber webhook 格式：
 * {
 *   "event": "message",
 *   "timestamp": 1700000000000,
 *   "message_token": 123456789,
 *   "sender": {
 *     "id": "user-viber-id",
 *     "name": "User Name"
 *   },
 *   "message": {
 *     "type": "text",
 *     "text": "Hello"
 *   }
 * }
 */
export function normalizeViber(body: any): NormalizedMessage | null {
  if (!body || body.event !== 'message') return null

  const message = body.message
  const sender = body.sender

  // 只處理文字訊息
  if (!message || message.type !== 'text' || !message.text) return null
  if (!sender || !sender.id) return null

  const timestamp = body.timestamp
    ? new Date(body.timestamp).toISOString()
    : new Date().toISOString()

  return {
    source: 'viber',
    source_user_id: sender.id,
    platform_message_id: String(body.message_token || ''),
    text: message.text.trim(),
    timestamp,
    viber_user_id: sender.id,
  }
}

/**
 * 驗證 Viber webhook 簽名（HMAC-SHA256）
 * Viber 使用 X-Viber-Content-Signature header
 */
export async function verifyViber(
  rawBody: string,
  signature: string,
  authToken: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(authToken),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
    const hex = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return hex === signature
  } catch {
    return false
  }
}
