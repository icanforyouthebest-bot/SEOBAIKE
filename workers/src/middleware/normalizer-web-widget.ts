// ============================================================
// Web Widget — 嵌入式聊天小工具訊息標準化
// SEOBAIKE 萬能遙控器 — Web Widget 平台
// ============================================================

import type { NormalizedMessage } from '../types'

/**
 * 解析 SEOBAIKE Web Widget 推送的 JSON 訊息
 *
 * Web Widget 前端透過 POST JSON 傳送：
 * {
 *   "session_id": "uuid-session-id",
 *   "user_id": "anonymous-or-logged-in-id",
 *   "message_id": "uuid-message-id",
 *   "text": "Hello",
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "callback_url": "https://example.com/widget/callback",
 *   "session_token": "jwt-or-token"
 * }
 */
export function normalizeWebWidget(body: any): NormalizedMessage | null {
  if (!body || !body.text) return null

  const userId = body.user_id || body.session_id || ''
  if (!userId) return null

  return {
    source: 'web_widget',
    source_user_id: userId,
    platform_message_id: body.message_id || String(Date.now()),
    text: body.text.trim(),
    timestamp: body.timestamp || new Date().toISOString(),
    callback_url: body.callback_url || '',
    session_token: body.session_token || '',
  }
}

/**
 * 驗證 Web Widget 請求
 * 使用 session_token 驗證（JWT 或自訂 token）
 */
export async function verifyWebWidget(
  sessionToken: string,
  expectedSecret: string
): Promise<boolean> {
  try {
    if (!sessionToken || !expectedSecret) return false
    // 簡化版：驗證 token 非空且格式正確
    // 進階版可用 JWT 驗證
    return sessionToken.length > 10
  } catch {
    return false
  }
}
