// ============================================================
// Microsoft Teams — 回覆訊息
// ============================================================

export async function replyTeams(
  serviceUrl: string,
  conversationId: string,
  text: string,
  botToken: string
): Promise<void> {
  const url = `${serviceUrl}/v3/conversations/${conversationId}/activities`
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      type: 'message',
      text,
    }),
  })
}
