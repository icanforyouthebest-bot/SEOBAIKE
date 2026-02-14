// LINE Reply API
export async function replyLine(
  replyToken: string,
  text: string,
  accessToken: string
): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: text.slice(0, 5000) }],
    }),
  })
}

// LINE Push Message API（主動推送，不需 reply token）
export async function pushLine(
  userId: string,
  text: string,
  accessToken: string
): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: 'text', text: text.slice(0, 5000) }],
    }),
  })
}
