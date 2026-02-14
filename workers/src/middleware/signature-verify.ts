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
