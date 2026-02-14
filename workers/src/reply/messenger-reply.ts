// Messenger Send API
export async function replyMessenger(
  senderId: string,
  text: string,
  pageAccessToken: string
): Promise<void> {
  await fetch('https://graph.facebook.com/v21.0/me/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: { text: text.slice(0, 2000) },
    }),
  })
}
