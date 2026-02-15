// ============================================================
// WeChat Official Account — 回覆訊息
// SEOBAIKE 萬能遙控器 — 微信公眾號平台
// ============================================================

/**
 * 透過 WeChat 客服訊息 API 主動回覆使用者
 * 需要先取得 access_token
 *
 * @param openId - 使用者的 OpenID
 * @param text - 回覆文字
 * @param accessToken - WeChat API access_token
 */
export async function replyWechat(
  openId: string,
  text: string,
  accessToken: string
): Promise<void> {
  const url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      touser: openId,
      msgtype: 'text',
      text: {
        content: text,
      },
    }),
  })
}

/**
 * 取得 WeChat API access_token
 * access_token 有效期 7200 秒，應快取使用
 *
 * @param appId - 公眾號 AppID
 * @param appSecret - 公眾號 AppSecret
 * @returns access_token 字串
 */
export async function getWechatAccessToken(
  appId: string,
  appSecret: string
): Promise<string> {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
  const resp = await fetch(url)
  const data = (await resp.json()) as any
  return data.access_token || ''
}
