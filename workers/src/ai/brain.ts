// ============================================================
// BAIKE AI Brain — Cloudflare Workers AI (免費)
// ============================================================

const SYSTEM = `你是 BAIKE，台灣公司小路光打造的 AI 管理助手。
風格：專業親切，像很懂的秘書跟老闆匯報。
語言：繁體中文，自然口吻。簡潔有力，不廢話。
每次回覆最後署名「— BAIKE AI」。
你擅長 SEO、數位行銷、企業管理、合規、財務。`

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
    return res.response || '抱歉，我暫時無法回應。\n\n— BAIKE AI'
  } catch {
    return '抱歉，我暫時無法回應。\n\n— BAIKE AI'
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
      reply: data.reply || '抱歉，AI 暫時無法回應。\n\n— BAIKE AI',
      allowed: true,
      constrained: true,
      industry: data.industry,
      session_id: data.session_id,
    }
  } catch (err) {
    console.error('aiConstrainedChat error:', err)
    return {
      reply: '抱歉，AI 約束系統暫時無法連線。\n\n— BAIKE AI',
      allowed: false,
      constrained: false,
    }
  }
}

function fallback(data: any): string {
  if (!data) return '沒有資料。\n\n— BAIKE AI'
  if (data.error) return `發生錯誤：${data.error}\n\n— BAIKE AI`
  if (data.message && typeof data.message === 'string') return `${data.message}\n\n— BAIKE AI`
  return JSON.stringify(data, null, 2)
}
