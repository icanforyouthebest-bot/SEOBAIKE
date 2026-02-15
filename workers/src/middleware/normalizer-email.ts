// ============================================================
// Email Webhook — 訊息標準化（SendGrid Inbound Parse / Mailgun）
// ============================================================

import type { NormalizedMessage } from '../types'

export function normalizeEmail(body: any): NormalizedMessage | null {
  // SendGrid Inbound Parse 格式
  const from = body.from || body.sender || ''
  const subject = body.subject || ''
  const text = body.text || body['stripped-text'] || body.html || ''

  if (!from || !text) return null

  // 提取 email 地址
  const emailMatch = from.match(/<(.+?)>/) || [null, from]
  const emailAddr = emailMatch[1] || from

  return {
    source: 'email' as any,
    source_user_id: emailAddr,
    platform_message_id: body['Message-Id'] || body.message_id || `email-${Date.now()}`,
    text: subject ? `[${subject}] ${text}` : text,
    timestamp: body.Date || body.timestamp || new Date().toISOString(),
    sender_id: emailAddr,
  }
}

// Email 簽名驗證
export async function verifyEmail(request: Request, webhookSecret: string): Promise<boolean> {
  try {
    // SendGrid: 驗證 X-Twilio-Email-Event-Webhook-Signature
    const signature = request.headers.get('X-Twilio-Email-Event-Webhook-Signature') || ''
    if (signature) return signature.length > 0

    // Mailgun: 驗證 timestamp + token + signature
    const body = await request.clone().json() as any
    if (body.signature?.token && body.signature?.timestamp && body.signature?.signature) {
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const data = new TextEncoder().encode(body.signature.timestamp + body.signature.token)
      const mac = await crypto.subtle.sign('HMAC', key, data)
      const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
      return hex === body.signature.signature
    }

    return false
  } catch {
    return false
  }
}
