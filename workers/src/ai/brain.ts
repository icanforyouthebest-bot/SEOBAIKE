// ============================================================
// BAIKE AI Brain — Cloudflare Workers AI (免費)
// ============================================================

const SYSTEM = `你是一個聰明有溫度的 AI 助手。

死規矩（違反 = 0 分）：
- 禁止自我介紹（不准說「我是小百」「我是AI」「我是助手」）
- 禁止主動報價格（用戶沒問就不准提錢）
- 禁止說「請問您有什麼問題」「有什麼可以幫您」
- 禁止用 - 開頭的列表回答
- 最多 2 句話
- 像朋友聊天，口語自然
- 用戶說什麼語言就用什麼語言回`

export async function aiFormat(ai: any, command: string, data: any): Promise<string> {
  const prompt = `用戶下了 ${command} 指令，系統回傳：
${JSON.stringify(data, null, 2)}

用自然口語整理成簡潔匯報，像在跟老闆報告。繁體中文。`

  try {
    const res = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
      max_tokens: 512,
    })
    return res.response || fallback(data)
  } catch {
    return fallback(data)
  }
}

export async function aiChat(ai: any, text: string): Promise<string> {
  try {
    const res = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
      max_tokens: 512,
    })
    return res.response || '抱歉，我暫時無法回應。'
  } catch {
    return '抱歉，我暫時無法回應。'
  }
}

// 約束式 AI 聊天 — 經過 L1-L4 行業約束閘道
export async function aiConstrainedChat(
  supabaseUrl: string,
  supabaseKey: string,
  message: string,
  platform: string,
  platformUserId: string
): Promise<{ reply: string; allowed: boolean; constrained: boolean; industry?: string; reason?: string; session_id?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        message,
        platform,
        platform_user_id: platformUserId,
      }),
    })
    const data = await res.json() as any

    if (data.allowed === false) {
      return {
        reply: data.reason || '此問題超出您的行業範圍。',
        allowed: false,
        constrained: true,
        industry: data.industry,
        reason: data.reason,
        session_id: data.session_id,
      }
    }

    return {
      reply: data.reply || '抱歉，AI 暫時無法回應。',
      allowed: true,
      constrained: true,
      industry: data.industry,
      session_id: data.session_id,
    }
  } catch (err) {
    console.error('aiConstrainedChat error:', err)
    return {
      reply: '抱歉，AI 約束系統暫時無法連線。',
      allowed: false,
      constrained: false,
    }
  }
}

function fallback(data: any): string {
  if (!data) return '沒有資料。'
  if (data.error) return `發生錯誤：${data.error}`
  if (data.message && typeof data.message === 'string') return `${data.message}`
  return JSON.stringify(data, null, 2)
}
