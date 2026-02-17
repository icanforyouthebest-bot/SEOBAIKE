import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// SEO Article Generator — 每日自動生成 SEO 文章
// 關鍵字池：牙醫 SEO、AI 客服、長尾關鍵字
// 使用 ai-gateway 同款 provider fallback 架構
// ============================================================

interface Provider {
  name: string
  url: string
  envKey: string
  model: string
}

const PROVIDERS: Provider[] = [
  { name: 'nvidia', url: 'https://integrate.api.nvidia.com/v1/chat/completions', envKey: 'NVIDIA_API_KEY', model: 'meta/llama-3.3-70b-instruct' },
  { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', envKey: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
  { name: 'deepseek', url: 'https://api.deepseek.com/v1/chat/completions', envKey: 'DEEPSEEK_API_KEY', model: 'deepseek-chat' },
  { name: 'openai', url: 'https://api.openai.com/v1/chat/completions', envKey: 'OPENAI_API_KEY', model: 'gpt-4o-mini' },
  { name: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', envKey: 'OPENROUTER_API_KEY', model: 'meta-llama/llama-3.3-70b-instruct' },
]

const KEYWORDS = [
  '牙醫 SEO',
  'AI 客服',
  '長尾關鍵字',
  '牙醫診所行銷',
  'AI 聊天機器人',
  'SEO 優化策略',
  '牙醫網站設計',
  'AI 自動回覆客服',
  '長尾關鍵字策略',
  '牙科數位行銷',
  'AI 客服導入指南',
  'SEO 內容行銷',
]

const ARTICLE_SYSTEM_PROMPT = `你是 SEOBAIKE 的專業 SEO 內容撰寫師。
任務：根據指定關鍵字撰寫一篇高品質 SEO 文章。
要求：
1. 繁體中文，台灣用語
2. 標題包含主關鍵字，吸引點擊
3. 文章結構：前言 → 3-5 個小標題段落 → 結論
4. 每個段落 150-300 字
5. 自然融入關鍵字，密度 1-2%
6. 提供實用建議，不空泛
7. 語調專業但親切
8. 文末加上 CTA 引導讀者行動
9. 同時產出 meta description (120-155 字)

輸出格式（嚴格遵守）：
---TITLE---
文章標題
---META---
meta description
---SLUG---
url-friendly-slug-in-english
---CONTENT---
完整文章內容（Markdown 格式）`

async function callAI(
  messages: { role: string; content: string }[],
): Promise<{ ok: boolean; reply: string; provider: string; model: string }> {
  for (const provider of PROVIDERS) {
    const apiKey = Deno.env.get(provider.envKey)
    if (!apiKey) continue

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000) // 文章生成給 15 秒

    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_tokens: 4096,
          temperature: 0.8,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        console.error(`[seo-gen] ${provider.name} HTTP ${res.status}`)
        continue
      }

      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || ''
      if (!reply) continue

      return { ok: true, reply, provider: provider.name, model: provider.model }
    } catch (err) {
      console.error(`[seo-gen] ${provider.name} error: ${(err as Error).message}`)
      continue
    } finally {
      clearTimeout(timer)
    }
  }
  return { ok: false, reply: '', provider: '', model: '' }
}

function parseArticle(raw: string) {
  const titleMatch = raw.match(/---TITLE---\s*\n(.*)/m)
  const metaMatch = raw.match(/---META---\s*\n([\s\S]*?)(?=---SLUG---|---CONTENT---|$)/m)
  const slugMatch = raw.match(/---SLUG---\s*\n(.*)/m)
  const contentMatch = raw.match(/---CONTENT---\s*\n([\s\S]*)/m)

  return {
    title: titleMatch?.[1]?.trim() || 'Untitled',
    meta_description: metaMatch?.[1]?.trim() || '',
    slug: slugMatch?.[1]?.trim() || `article-${Date.now()}`,
    content: contentMatch?.[1]?.trim() || raw,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const keyword = body.keyword || KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)]
    const count = Math.min(body.count || 1, 3) // 最多一次生成 3 篇

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const results = []

    for (let i = 0; i < count; i++) {
      const selectedKeyword = i === 0 ? keyword : KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)]

      const messages = [
        { role: 'system', content: ARTICLE_SYSTEM_PROMPT },
        { role: 'user', content: `請為關鍵字「${selectedKeyword}」撰寫一篇 SEO 文章。目標受眾：台灣中小企業老闆。` },
      ]

      const ai = await callAI(messages)
      if (!ai.ok) {
        results.push({ keyword: selectedKeyword, error: 'All providers failed' })
        continue
      }

      const parsed = parseArticle(ai.reply)
      const wordCount = parsed.content.length

      // 確保 slug 唯一
      const uniqueSlug = `${parsed.slug}-${Date.now().toString(36)}`

      const { data, error } = await supabase.from('seo_articles').insert({
        title: parsed.title,
        slug: uniqueSlug,
        keyword: selectedKeyword,
        content: parsed.content,
        meta_description: parsed.meta_description,
        status: 'draft',
        language: 'zh-TW',
        word_count: wordCount,
        provider: ai.provider,
        model: ai.model,
      }).select('id, title, slug, keyword, word_count, provider').single()

      if (error) {
        console.error('[seo-gen] DB insert error:', error.message)
        results.push({ keyword: selectedKeyword, error: error.message })
      } else {
        results.push(data)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      generated: results.length,
      articles: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[seo-gen] error:', error)
    return new Response(JSON.stringify({
      error: 'Article generation failed',
      message: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
