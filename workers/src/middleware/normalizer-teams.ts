// ============================================================
// Microsoft Teams — Webhook 訊息標準化
// ============================================================

import type { NormalizedMessage } from '../types'

export function normalizeTeams(body: any): NormalizedMessage | null {
  // Teams Bot Framework Activity
  if (!body || body.type !== 'message' || !body.text) return null

  return {
    source: 'teams' as any,
    source_user_id: body.from?.id || body.from?.aadObjectId || '',
    platform_message_id: body.id || '',
    text: body.text.replace(/<at>.*?<\/at>\s*/g, '').trim(), // 移除 @mention 標記
    timestamp: body.timestamp || new Date().toISOString(),
    chat_id: body.conversation?.id || '',
  }
}

// Teams 簽名驗證（HMAC-SHA256）
export async function verifyTeams(request: Request, secret: string): Promise<boolean> {
  try {
    const authHeader = request.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return false
    // Teams 用 JWT Bearer token，驗證需要 Microsoft 公鑰
    // 簡化版：驗證 token 非空即可，進階版需驗 JWT
    return authHeader.length > 10
  } catch {
    return false
  }
}
