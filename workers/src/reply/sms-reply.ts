// ============================================================
// SMS / Twilio — 回覆訊息
// SEOBAIKE 萬能遙控器 — Twilio SMS 平台
// ============================================================

/**
 * 透過 Twilio REST API 發送 SMS 回覆
 *
 * @param toNumber - 接收者電話號碼（含國碼，如 +886912345678）
 * @param text - 回覆文字
 * @param fromNumber - Twilio 電話號碼（發送者）
 * @param accountSid - Twilio Account SID
 * @param authToken - Twilio Auth Token
 */
export async function replySms(
  toNumber: string,
  text: string,
  fromNumber: string,
  accountSid: string,
  authToken: string
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

  // Twilio API 使用 Basic Auth + form-urlencoded
  const credentials = btoa(`${accountSid}:${authToken}`)
  const body = new URLSearchParams({
    To: toNumber,
    From: fromNumber,
    Body: text,
  })

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: body.toString(),
  })
}
