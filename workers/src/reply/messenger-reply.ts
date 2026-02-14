// Messenger Send API
export async function replyMessenger(
  senderId: string,
  text: string,
  pageAccessToken: string
): Promise<void> {
  await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: { text: text.slice(0, 2000) },
    }),
  })
}
