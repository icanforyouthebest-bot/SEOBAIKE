// ============================================================
// Viber — 回覆訊息
// SEOBAIKE 萬能遙控器 — Viber Bot 平台
// ============================================================

/**
 * 透過 Viber Bot API 發送回覆訊息
 *
 * @param receiverId - 接收者的 Viber user ID
 * @param text - 回覆文字
 * @param authToken - Viber Bot auth token
 */
export async function replyViber(
  receiverId: string,
  text: string,
  authToken: string
): Promise<void> {
  const url = 'https://chatapi.viber.com/pa/send_message'
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Viber-Auth-Token': authToken,
    },
    body: JSON.stringify({
      receiver: receiverId,
      type: 'text',
      text,
      sender: {
        name: 'SEOBAIKE',
      },
    }),
  })
}
