// ============================================================
// Discord 訊息標準化 — Discord Webhook → NormalizedMessage
// ============================================================

import type { NormalizedMessage } from '../types'

/**
 * 標準化 Discord 互動事件（Interaction）
 * Discord Bot 收到的 webhook 為 Interaction 格式
 * 支援 MESSAGE_CREATE（type=0 指令訊息）和 APPLICATION_COMMAND（type=2 slash 指令）
 */
export function normalizeDiscord(body: any): NormalizedMessage | null {
  // Discord Interaction type 定義：
  // 1 = PING（由 verifyDiscord 處理，不進入此函數）
  // 2 = APPLICATION_COMMAND（slash 指令）
  // 3 = MESSAGE_COMPONENT（按鈕等互動元件）
  // 4 = APPLICATION_COMMAND_AUTOCOMPLETE
  // 其他非訊息類型直接忽略

  const interactionType = body?.type

  // APPLICATION_COMMAND (slash command)
  if (interactionType === 2) {
    const data = body.data
    if (!data?.name) return null

    // 組合 slash command 文字：/name [options...]
    let text = `/${data.name}`
    if (data.options?.length) {
      const optParts = data.options.map((opt: any) => {
        if (opt.value !== undefined) return String(opt.value)
        return opt.name
      })
      text += ' ' + optParts.join(' ')
    }

    return {
      source: 'discord',
      source_user_id: body.member?.user?.id || body.user?.id || '',
      platform_message_id: body.id || '',
      text,
      timestamp: body.id ? snowflakeToISO(body.id) : new Date().toISOString(),
      channel_id: body.channel_id || '',
    }
  }

  // MESSAGE_COMPONENT (button click 等)
  if (interactionType === 3) {
    const customId = body.data?.custom_id
    if (!customId) return null

    return {
      source: 'discord',
      source_user_id: body.member?.user?.id || body.user?.id || '',
      platform_message_id: body.id || '',
      text: customId,
      timestamp: body.id ? snowflakeToISO(body.id) : new Date().toISOString(),
      channel_id: body.channel_id || '',
    }
  }

  // Gateway MESSAGE_CREATE event（透過 Bot 轉發的純文字訊息）
  // 這適用於透過 Gateway → Webhook relay 的架構
  if (body.content !== undefined && body.author) {
    // 忽略 bot 自己的訊息
    if (body.author.bot) return null

    return {
      source: 'discord',
      source_user_id: body.author.id || '',
      platform_message_id: body.id || '',
      text: body.content || '',
      timestamp: body.timestamp || new Date().toISOString(),
      channel_id: body.channel_id || '',
    }
  }

  return null
}

/**
 * Discord Snowflake ID → ISO 時間戳
 * Discord 的 ID 內含時間戳（毫秒自 2015-01-01）
 */
function snowflakeToISO(snowflake: string): string {
  const DISCORD_EPOCH = 1420070400000n
  try {
    const ms = (BigInt(snowflake) >> 22n) + DISCORD_EPOCH
    return new Date(Number(ms)).toISOString()
  } catch {
    return new Date().toISOString()
  }
}
