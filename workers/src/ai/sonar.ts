// ============================================================
// BAIKE AI Brain — Perplexity Sonar Reasoning Pro
// 讓遙控器有真正的 AI 腦
// ============================================================

export interface SonarResponse {
  text: string
  citations?: string[]
}

const SYSTEM_PROMPT = `你是 BAIKE，一個由台灣公司小路光打造的 AI 管理助手。
你的風格：專業但親切，像一個很懂的秘書在跟老闆匯報。
語言：繁體中文，口吻自然，不要太正式。
回覆簡潔有力，不廢話。每次回覆最後署名「— BAIKE AI」。
你擅長 SEO、數位行銷、企業管理、合規、財務分析。
你背後有完整的企業資料庫，用戶問你的東西你都查得到。`

export async function askSonar(
  apiKey: string,
  userMessage: string,
  context?: any
): Promise<SonarResponse> {
  let prompt = userMessage

  // 如果有結構化資料（從 SQL handler 回來的），餵給 Sonar 當 context
  if (context && typeof context === 'object') {
    prompt = `用戶下了指令，系統回傳了以下資料，請用自然口語幫我整理成簡潔的匯報：

系統資料：
${JSON.stringify(context, null, 2)}

用戶原始指令：${userMessage}

請用繁體中文回覆，簡潔有力，像在跟老闆匯報。`
  }

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar-reasoning-pro',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sonar API error ${res.status}: ${err}`)
  }

  const data = await res.json() as any
  const text = data.choices?.[0]?.message?.content || '抱歉，我暫時無法回應。'
  const citations = data.citations || []

  return { text, citations }
}
