// ============================================================
// Google Chat — Webhook 訊息標準化
// ============================================================

import type { NormalizedMessage } from '../types'

export function normalizeGoogleChat(body: any): NormalizedMessage | null {
  // Google Chat Bot event
  if (!body || body.type !== 'MESSAGE' || !body.message?.text) return null

  return {
    source: 'google_chat' as any,
    source_user_id: body.user?.name || body.message?.sender?.name || '',
    platform_message_id: body.message?.name || `gchat-${Date.now()}`,
    text: body.message.text.replace(/@\S+\s*/g, '').trim(), // 移除 @mention
    timestamp: body.eventTime || new Date().toISOString(),
    chat_id: body.space?.name || '',
  }
}

// Google Chat 簽名驗證（Bearer token from Google）
export async function verifyGoogleChat(request: Request, projectId: string): Promise<boolean> {
  try {
    const authHeader = request.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return false
    // 簡化版：驗證 token 非空
    // 進階版：需驗證 Google JWT token audience
    return authHeader.length > 20
  } catch {
    return false
  }
}
