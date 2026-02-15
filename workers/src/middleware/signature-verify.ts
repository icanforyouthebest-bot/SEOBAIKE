// ============================================================
// 簽名驗證 — 各平台 Webhook 安全驗證
// ============================================================

import type { Env } from '../types'

export async function verifyLine(request: Request, env: Env): Promise<boolean> {
  const signature = request.headers.get('x-line-signature')
  if (!signature) return false

  const body = await request.clone().text()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.LINE_CHANNEL_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return signature === expected
}

export async function verifyTelegram(request: Request, env: Env): Promise<boolean> {
  const token = request.headers.get('x-telegram-bot-api-secret-token')
  return token === env.TELEGRAM_SECRET_TOKEN
}

export async function verifyWhatsApp(request: Request, env: Env): Promise<boolean> {
  const signature = request.headers.get('x-hub-signature-256')
  if (!signature) return false

  const body = await request.clone().text()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.WHATSAPP_ACCESS_TOKEN),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return signature === `sha256=${hex}`
}

export async function verifyMessenger(request: Request, env: Env): Promise<boolean> {
  const signature = request.headers.get('x-hub-signature-256')
  if (!signature) return false

  const body = await request.clone().text()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.MESSENGER_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return signature === `sha256=${hex}`
}

/**
 * Discord 簽名驗證 — Ed25519
 * Discord 使用 Ed25519 簽名驗證 Interaction webhook
 * Headers: X-Signature-Ed25519（hex 簽名）, X-Signature-Timestamp
 * 驗證內容: timestamp + body
 * 使用 Web Crypto API（Cloudflare Workers 原生支援 Ed25519）
 */
export async function verifyDiscord(request: Request, env: Env): Promise<boolean> {
  const signature = request.headers.get('x-signature-ed25519')
  const timestamp = request.headers.get('x-signature-timestamp')
  if (!signature || !timestamp) return false

  try {
    const body = await request.clone().text()
    const message = new TextEncoder().encode(timestamp + body)

    // 將 hex public key 轉為 Uint8Array
    const publicKeyHex = env.DISCORD_PUBLIC_KEY
    const publicKeyBytes = hexToUint8Array(publicKeyHex)

    // 匯入 Ed25519 公鑰（Cloudflare Workers 支援 Ed25519 via Web Crypto API）
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    )

    // 將 hex 簽名轉為 Uint8Array
    const signatureBytes = hexToUint8Array(signature)

    // 驗證簽名
    const isValid = await crypto.subtle.verify(
      'Ed25519',
      cryptoKey,
      signatureBytes,
      message
    )

    return isValid
  } catch (err) {
    console.error('[Discord] Signature verification failed:', err)
    return false
  }
}

/**
 * Slack 簽名驗證 — HMAC-SHA256
 * Slack 使用 HMAC-SHA256 簽名驗證 Events API webhook
 * Headers: X-Slack-Signature（v0=hex_hash）, X-Slack-Request-Timestamp
 * 驗證內容: v0:{timestamp}:{body}
 * 另外檢查 timestamp 不超過 5 分鐘（防重放攻擊）
 */
export async function verifySlack(request: Request, env: Env): Promise<boolean> {
  const signature = request.headers.get('x-slack-signature')
  const timestamp = request.headers.get('x-slack-request-timestamp')
  if (!signature || !timestamp) return false

  // 防重放攻擊：timestamp 不超過 5 分鐘
  const now = Math.floor(Date.now() / 1000)
  const ts = parseInt(timestamp, 10)
  if (Math.abs(now - ts) > 300) return false

  try {
    const body = await request.clone().text()
    const sigBaseString = `v0:${timestamp}:${body}`

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.SLACK_SIGNING_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigBaseString))
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
    const expected = `v0=${hex}`

    return timingSafeEqual(signature, expected)
  } catch (err) {
    console.error('[Slack] Signature verification failed:', err)
    return false
  }
}

// ============================================================
// 工具函數
// ============================================================

/** hex 字串 → Uint8Array */
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

/** 固定時間比較（防 timing attack） */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  let result = 0
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i]
  }
  return result === 0
}
