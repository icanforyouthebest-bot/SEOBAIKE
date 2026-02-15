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

  // Discord
  DISCORD_BOT_TOKEN: string
  DISCORD_PUBLIC_KEY: string
  DISCORD_APPLICATION_ID: string

  // Slack
  SLACK_BOT_TOKEN: string
  SLACK_SIGNING_SECRET: string

  // Microsoft Teams
  TEAMS_BOT_TOKEN: string
  TEAMS_APP_ID: string

  // Email (SendGrid)
  EMAIL_API_KEY: string
  EMAIL_WEBHOOK_SECRET: string

  // Google Chat
  GOOGLE_CHAT_BOT_TOKEN: string
  GOOGLE_CHAT_PROJECT_ID: string

  // NVIDIA NIM
  NVIDIA_API_KEY: string

  // AI 超級市集 — 全供應商
  OPENROUTER_API_KEY: string      // OpenRouter 400+ 模型聚合器
  GOOGLE_AI_KEY: string           // Google Gemini
  GROQ_API_KEY: string            // Groq 超高速推理
  TOGETHER_API_KEY: string        // Together AI 200+ 模型
  FIREWORKS_API_KEY: string       // Fireworks AI
  DEEPSEEK_API_KEY: string        // DeepSeek
  MISTRAL_API_KEY: string         // Mistral AI
  COHERE_API_KEY: string          // Cohere
  ANTHROPIC_API_KEY: string       // Anthropic Claude/Opus

  // WeChat
  WECHAT_APP_ID: string
  WECHAT_APP_SECRET: string
  WECHAT_TOKEN: string

  // Signal
  SIGNAL_BOT_NUMBER: string
  SIGNAL_REST_API_URL: string

  // Viber
  VIBER_AUTH_TOKEN: string

  // SMS (Twilio)
  TWILIO_ACCOUNT_SID: string
  TWILIO_AUTH_TOKEN: string
  TWILIO_PHONE_NUMBER: string

  // Stripe
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string

  // Resend
  RESEND_API_KEY: string

  // Composio MCP
  COMPOSIO_API_KEY: string

  // KV for rate limiting
  RATE_LIMIT: KVNamespace

  // Supabase Anon Key (for client-side auth)
  SUPABASE_ANON_KEY: string
}

export interface NormalizedMessage {
  source: 'line' | 'telegram' | 'whatsapp' | 'messenger' | 'discord' | 'slack' | 'teams' | 'email' | 'google_chat' | 'web' | 'wechat' | 'signal' | 'viber' | 'sms' | 'web_widget'
  source_user_id: string
  platform_message_id: string
  text: string
  timestamp: string
  // Platform-specific reply info
  reply_token?: string   // LINE
  chat_id?: string       // Telegram
  phone_number?: string  // WhatsApp
  sender_id?: string     // Messenger
  channel_id?: string    // Discord / Slack
  // Discord Interaction 回覆用
  interaction_id?: string
  interaction_token?: string
  // WeChat
  open_id?: string            // WeChat OpenID
  // Viber
  viber_user_id?: string      // Viber user ID
  // SMS / Twilio
  from_number?: string        // 發送者電話號碼
  // Web Widget
  callback_url?: string       // Web Widget 回呼 URL
  session_token?: string      // Web Widget session token
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
  channel_id?: string        // Discord / Slack
  service_url?: string       // Teams
  space_name?: string        // Google Chat
  email_subject?: string     // Email
  open_id?: string           // WeChat
  viber_user_id?: string     // Viber
  from_number?: string       // SMS / Twilio
  callback_url?: string      // Web Widget
  session_token?: string     // Web Widget
}
