// ============================================================
// WeChat Official Account — Webhook 訊息標準化
// SEOBAIKE 萬能遙控器 — 微信公眾號平台
// ============================================================

import type { NormalizedMessage } from '../types'

/**
 * 解析 WeChat Official Account 推送的 XML 訊息
 * WeChat 推送格式為 XML，需先轉為物件再標準化
 *
 * @param body - 已解析的 XML 物件（由上游 XML parser 轉換）
 *   預期欄位：
 *   - ToUserName: 開發者帳號
 *   - FromUserName: 發送者 OpenID
 *   - CreateTime: Unix 時間戳
 *   - MsgType: text / image / voice 等
 *   - Content: 文字內容（MsgType=text 時）
 *   - MsgId: 訊息 ID
 */
export function normalizeWechat(body: any): NormalizedMessage | null {
  if (!body || !body.MsgType || !body.FromUserName) return null

  // 目前只處理文字訊息
  if (body.MsgType !== 'text' || !body.Content) return null

  const timestamp = body.CreateTime
    ? new Date(Number(body.CreateTime) * 1000).toISOString()
    : new Date().toISOString()

  return {
    source: 'wechat',
    source_user_id: body.FromUserName,
    platform_message_id: String(body.MsgId || ''),
    text: body.Content.trim(),
    timestamp,
    open_id: body.FromUserName,
  }
}

/**
 * 驗證 WeChat 伺服器簽名（SHA1）
 * WeChat 使用 token + timestamp + nonce 排序後做 SHA1
 */
export async function verifyWechat(
  signature: string,
  timestamp: string,
  nonce: string,
  token: string
): Promise<boolean> {
  try {
    const arr = [token, timestamp, nonce].sort()
    const str = arr.join('')
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-1', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex === signature
  } catch {
    return false
  }
}
