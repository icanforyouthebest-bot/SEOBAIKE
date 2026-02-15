// ============================================================
// Google Chat — 回覆訊息
// ============================================================

export async function replyGoogleChat(
  spaceName: string,
  text: string,
  botToken: string
): Promise<void> {
  const url = `https://chat.googleapis.com/v1/${spaceName}/messages`
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      text,
    }),
  })
}
