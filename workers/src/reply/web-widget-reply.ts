// ============================================================
// Web Widget — 回覆訊息
// SEOBAIKE 萬能遙控器 — Web Widget 平台
// ============================================================

/**
 * 透過 callback URL 回覆 Web Widget 訊息
 * Web Widget 前端提供一個 callback URL，後端 POST 回覆內容
 *
 * @param callbackUrl - 前端提供的回呼 URL
 * @param text - 回覆文字
 * @param sessionToken - session token（用於驗證身份）
 */
export async function replyWebWidget(
  callbackUrl: string,
  text: string,
  sessionToken: string
): Promise<void> {
  if (!callbackUrl) {
    // 無 callback URL 時，回覆內容由呼叫端直接作為 HTTP response 回傳
    // 這種情況下不需要額外發送請求
    return
  }

  await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      type: 'message',
      text,
      timestamp: new Date().toISOString(),
      sender: 'SEOBAIKE',
    }),
  })
}

/**
 * 建構同步回覆 Response（用於無 callback URL 的情況）
 * Web Widget 可直接等待 HTTP response 取得回覆
 *
 * @param text - 回覆文字
 * @returns Response 物件
 */
export function buildWebWidgetResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      type: 'message',
      text,
      timestamp: new Date().toISOString(),
      sender: 'SEOBAIKE',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  )
}
