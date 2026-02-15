// ============================================================
// Slack 回覆 — 透過 Slack Web API 傳送訊息
// ============================================================

/**
 * 回覆 Slack 頻道訊息
 * 使用 chat.postMessage API
 */
export async function replySlack(
  channelId: string,
  text: string,
  botToken: string
): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text: text.slice(0, 4000),
    }),
  })
}

/**
 * 回覆 Slack 訊息串（thread）
 * 使用 chat.postMessage API + thread_ts 參數
 */
export async function replySlackThread(
  channelId: string,
  threadTs: string,
  text: string,
  botToken: string
): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      thread_ts: threadTs,
      text: text.slice(0, 4000),
    }),
  })
}

/**
 * 主動推送 DM 訊息給 Slack 使用者
 * 先透過 conversations.open 開啟 DM 頻道，再傳送訊息
 */
export async function pushSlackDM(
  userId: string,
  text: string,
  botToken: string
): Promise<void> {
  // 開啟 DM 頻道
  const openRes = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${botToken}`,
    },
    body: JSON.stringify({ users: userId }),
  })
  const openData = await openRes.json() as any
  const dmChannelId = openData?.channel?.id
  if (!dmChannelId) return

  // 傳送訊息
  await replySlack(dmChannelId, text, botToken)
}
