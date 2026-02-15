// ============================================================
// Signal — 回覆訊息
// SEOBAIKE 萬能遙控器 — Signal Bot 平台
// ============================================================

/**
 * 透過 signal-cli-rest-api 發送回覆訊息
 *
 * @param recipientNumber - 接收者電話號碼（含國碼，如 +886912345678）
 * @param text - 回覆文字
 * @param botNumber - Signal Bot 的電話號碼
 * @param apiUrl - signal-cli-rest-api 的基礎 URL（如 http://localhost:8080）
 */
export async function replySignal(
  recipientNumber: string,
  text: string,
  botNumber: string,
  apiUrl: string
): Promise<void> {
  const url = `${apiUrl}/v2/send`
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: text,
      number: botNumber,
      recipients: [recipientNumber],
    }),
  })
}
