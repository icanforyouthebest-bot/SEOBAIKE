// ============================================================
// Signal — Webhook 訊息標準化
// SEOBAIKE 萬能遙控器 — Signal Bot 平台
// ============================================================

import type { NormalizedMessage } from '../types'

/**
 * 解析 Signal REST API（signal-cli-rest-api）推送的訊息
 *
 * Signal Bot 使用 signal-cli-rest-api，webhook 格式：
 * {
 *   "envelope": {
 *     "source": "+886912345678",
 *     "sourceDevice": 1,
 *     "timestamp": 1700000000000,
 *     "dataMessage": {
 *       "timestamp": 1700000000000,
 *       "message": "Hello",
 *       "groupInfo": null
 *     }
 *   }
 * }
 */
export function normalizeSignal(body: any): NormalizedMessage | null {
  if (!body || !body.envelope) return null

  const envelope = body.envelope
  const dataMessage = envelope.dataMessage

  // 只處理文字訊息（非群組）
  if (!dataMessage || !dataMessage.message) return null

  const sourceNumber = envelope.source || ''
  const timestamp = dataMessage.timestamp
    ? new Date(dataMessage.timestamp).toISOString()
    : new Date().toISOString()

  return {
    source: 'signal',
    source_user_id: sourceNumber,
    platform_message_id: String(dataMessage.timestamp || Date.now()),
    text: dataMessage.message.trim(),
    timestamp,
    phone_number: sourceNumber,
  }
}

/**
 * 驗證 Signal webhook（簡化版）
 * signal-cli-rest-api 本身通常部署在內網，可信任來源 IP
 */
export async function verifySignal(request: Request): Promise<boolean> {
  // signal-cli-rest-api 通常由本地或可信環境呼叫
  // 進階版可驗證 IP 白名單或自訂 header token
  const userAgent = request.headers.get('User-Agent') || ''
  return userAgent.length > 0
}
