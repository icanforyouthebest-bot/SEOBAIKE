// ============================================================
// 萬能遙控器 — 共用型別
// ============================================================

export interface Env {
  // Supabase
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string

  // LINE
  LINE_CHANNEL_SECRET: string
  LINE_CHANNEL_ACCESS_TOKEN: string

  // Telegram
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_SECRET_TOKEN: string

  // AI Brain (Cloudflare Workers AI — 免費)
  AI: any
  PERPLEXITY_API_KEY: string

  // WhatsApp (Meta)
  WHATSAPP_VERIFY_TOKEN: string
  WHATSAPP_ACCESS_TOKEN: string
  WHATSAPP_PHONE_NUMBER_ID: string

  // Messenger (Meta)
  MESSENGER_VERIFY_TOKEN: string
  MESSENGER_APP_SECRET: string
  MESSENGER_PAGE_ACCESS_TOKEN: string

  // KV for rate limiting
  RATE_LIMIT: KVNamespace
}

export interface NormalizedMessage {
  source: 'line' | 'telegram' | 'whatsapp' | 'messenger' | 'web'
  source_user_id: string
  platform_message_id: string
  text: string
  timestamp: string
  // Platform-specific reply info
  reply_token?: string   // LINE
  chat_id?: string       // Telegram
  phone_number?: string  // WhatsApp
  sender_id?: string     // Messenger
}

export interface CommandPayload {
  command: string
  userId: string | null
  metadata: {
    source: string
    source_user_id: string
    session_id: string
    sub_command: string | null
    args: Record<string, string>
    platform_message_id: string
    confirmed?: boolean
  }
}

export interface ReplyContext {
  source: NormalizedMessage['source']
  reply_token?: string
  chat_id?: string
  phone_number?: string
  sender_id?: string
}
