// ============================================================
// SMS / Twilio — Webhook 訊息標準化
// SEOBAIKE 萬能遙控器 — Twilio SMS 平台
// ============================================================

import type { NormalizedMessage } from '../types'

/**
 * 解析 Twilio SMS webhook（application/x-www-form-urlencoded）
 *
 * Twilio 推送的表單欄位：
 * - MessageSid: 訊息唯一 ID
 * - From: 發送者號碼（如 +886912345678）
 * - To: 接收者號碼（Twilio 號碼）
 * - Body: 簡訊內容
 * - NumMedia: 附件數量
 *
 * @param body - 已解析的 URLSearchParams 或 key-value 物件
 */
export function normalizeSms(body: any): NormalizedMessage | null {
  if (!body) return null

  // 支援 URLSearchParams 或普通物件
  const get = (key: string): string => {
    if (body instanceof URLSearchParams) return body.get(key) || ''
    return body[key] || ''
  }

  const from = get('From')
  const messageBody = get('Body')
  const messageSid = get('MessageSid')

  if (!from || !messageBody) return null

  return {
    source: 'sms',
    source_user_id: from,
    platform_message_id: messageSid,
    text: messageBody.trim(),
    timestamp: new Date().toISOString(),
    phone_number: from,
    from_number: from,
  }
}

/**
 * 驗證 Twilio webhook 簽名（HMAC-SHA1）
 * Twilio 使用 X-Twilio-Signature header
 *
 * @param url - 完整的 webhook URL
 * @param params - POST 參數（key-value 物件）
 * @param signature - X-Twilio-Signature header 值
 * @param authToken - Twilio Auth Token
 */
export async function verifySms(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): Promise<boolean> {
  try {
    // 1. 將參數按 key 排序後接在 URL 後面
    const sortedKeys = Object.keys(params).sort()
    let data = url
    for (const key of sortedKeys) {
      data += key + params[key]
    }

    // 2. HMAC-SHA1 簽名
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(authToken),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(data))

    // 3. Base64 編碼比對
    const base64 = btoa(String.fromCharCode(...new Uint8Array(mac)))
    return base64 === signature
  } catch {
    return false
  }
}
