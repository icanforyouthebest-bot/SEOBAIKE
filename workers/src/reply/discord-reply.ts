// ============================================================
// Discord 回覆 — 透過 Discord Bot API 傳送訊息
// ============================================================

/**
 * 回覆 Discord Interaction（用於 slash command / button 互動）
 * 使用 Interaction Callback endpoint
 * type 4 = CHANNEL_MESSAGE_WITH_SOURCE（一般回覆）
 */
export async function replyDiscordInteraction(
  interactionId: string,
  interactionToken: string,
  text: string
): Promise<void> {
  await fetch(
    `https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 4,
        data: {
          content: text.slice(0, 2000),
        },
      }),
    }
  )
}

/**
 * 傳送訊息到 Discord 頻道（用於主動推送 / Gateway 轉發的訊息回覆）
 * 使用 Channel Messages endpoint
 */
export async function replyDiscordChannel(
  channelId: string,
  text: string,
  botToken: string
): Promise<void> {
  await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${botToken}`,
      },
      body: JSON.stringify({
        content: text.slice(0, 2000),
      }),
    }
  )
}

/**
 * 編輯已傳送的 Interaction 回覆（用於延遲更新）
 */
export async function editDiscordInteractionReply(
  applicationId: string,
  interactionToken: string,
  text: string
): Promise<void> {
  await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: text.slice(0, 2000),
      }),
    }
  )
}
