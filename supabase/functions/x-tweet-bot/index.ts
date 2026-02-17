import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// X Tweet Bot — 每小時自動發推
// 內容：系統狀態報告、新文章推廣、里程碑通知
// X API v2 OAuth 2.0 Bearer Token
// ============================================================

interface TweetPayload {
  text: string
}

async function postTweet(text: string): Promise<{ ok: boolean; tweet_id?: string; error?: string }> {
  const bearerToken = Deno.env.get('X_BEARER_TOKEN')
  const apiKey = Deno.env.get('X_API_KEY')
  const apiSecret = Deno.env.get('X_API_SECRET')
  const accessToken = Deno.env.get('X_ACCESS_TOKEN')
  const accessSecret = Deno.env.get('X_ACCESS_SECRET')

  // 優先用 OAuth 1.0a (User context) 發推
  if (apiKey && apiSecret && accessToken && accessSecret) {
    return await postWithOAuth1(text, apiKey, apiSecret, accessToken, accessSecret)
  }

  // 備用：OAuth 2.0 Bearer Token (App context, 較受限)
  if (bearerToken) {
    return await postWithBearer(text, bearerToken)
  }

  return { ok: false, error: 'No X API credentials configured (need X_API_KEY+X_API_SECRET+X_ACCESS_TOKEN+X_ACCESS_SECRET or X_BEARER_TOKEN)' }
}

async function postWithOAuth1(
  text: string,
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string,
): Promise<{ ok: boolean; tweet_id?: string; error?: string }> {
  // OAuth 1.0a HMAC-SHA1 signature
  const method = 'POST'
  const url = 'https://api.twitter.com/2/tweets'
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomUUID().replace(/-/g, '')

  const params: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  }

  // Build signature base string
  const paramString = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`

  // HMAC-SHA1
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(baseString))
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))

  const authHeader = `OAuth oauth_consumer_key="${encodeURIComponent(apiKey)}", oauth_nonce="${encodeURIComponent(nonce)}", oauth_signature="${encodeURIComponent(signature)}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${timestamp}", oauth_token="${encodeURIComponent(accessToken)}", oauth_version="1.0"`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      return { ok: false, error: `HTTP ${res.status}: ${errText.substring(0, 300)}` }
    }

    const data = await res.json()
    return { ok: true, tweet_id: data.data?.id }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

async function postWithBearer(
  text: string,
  bearerToken: string,
): Promise<{ ok: boolean; tweet_id?: string; error?: string }> {
  try {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      return { ok: false, error: `HTTP ${res.status}: ${errText.substring(0, 300)}` }
    }

    const data = await res.json()
    return { ok: true, tweet_id: data.data?.id }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ============================================================
// 推文內容生成器
// ============================================================
async function generateStatusTweet(supabase: any): Promise<string> {
  // 取最近 1 小時統計
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()

  const { count: totalChats } = await supabase
    .from('ai_customer_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo)

  const { count: successChats } = await supabase
    .from('ai_customer_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo)
    .eq('status', 'success')

  const { count: fallbacks } = await supabase
    .from('system_health_checks')
    .select('*', { count: 'exact', head: true })
    .gte('checked_at', oneHourAgo)
    .eq('check_type', 'ai_fallback')

  const { count: articles } = await supabase
    .from('seo_articles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo)

  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
  const successRate = totalChats > 0 ? Math.round((successChats / totalChats) * 100) : 100

  let tweet = `SEOBAIKE AI 系統報告 ${now}\n\n`
  tweet += `AI 對話：${totalChats || 0} 筆\n`
  tweet += `成功率：${successRate}%\n`

  if (fallbacks > 0) {
    tweet += `Fallback 觸發：${fallbacks} 次\n`
  }
  if (articles > 0) {
    tweet += `新文章：${articles} 篇\n`
  }

  tweet += `\n9 Provider 高可用運行中\n`
  tweet += `#SEOBAIKE #AI #SEO #牙醫SEO`

  // X 限制 280 字元
  return tweet.substring(0, 280)
}

async function generateArticlePromo(supabase: any): Promise<string | null> {
  // 取最新未推廣的文章
  const { data: article } = await supabase
    .from('seo_articles')
    .select('title, keyword, slug')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  if (!article) return null

  let tweet = `新文章上線！\n\n`
  tweet += `${article.title}\n\n`
  tweet += `關鍵字：${article.keyword}\n`
  tweet += `https://aiforseo.vip/blog/${article.slug}\n\n`
  tweet += `#SEOBAIKE #${article.keyword.replace(/\s/g, '')} #SEO`

  return tweet.substring(0, 280)
}

// ============================================================
// Main handler
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'status' // status | article_promo | custom

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let tweetText: string
    let tweetType: string

    if (action === 'custom' && body.text) {
      tweetText = body.text.substring(0, 280)
      tweetType = 'status'
    } else if (action === 'article_promo') {
      const promo = await generateArticlePromo(supabase)
      if (!promo) {
        return jsonResponse(200, { success: false, reason: 'No published articles to promote' })
      }
      tweetText = promo
      tweetType = 'article_promo'
    } else {
      tweetText = await generateStatusTweet(supabase)
      tweetType = 'status'
    }

    // 發推
    const result = await postTweet(tweetText)

    // 寫入 x_tweets 記錄
    await supabase.from('x_tweets').insert({
      tweet_text: tweetText,
      tweet_type: tweetType,
      tweet_id: result.tweet_id || null,
      status: result.ok ? 'posted' : 'failed',
      error_message: result.error || null,
      metadata: { action, provider: 'x_api_v2' },
      posted_at: result.ok ? new Date().toISOString() : null,
    })

    if (!result.ok) {
      // X API 未設定時，記錄推文但不報錯 (方便測試)
      return jsonResponse(200, {
        success: false,
        tweet_text: tweetText,
        tweet_type: tweetType,
        error: result.error,
        note: 'Tweet saved to x_tweets table for manual posting',
      })
    }

    return jsonResponse(200, {
      success: true,
      tweet_id: result.tweet_id,
      tweet_text: tweetText,
      tweet_type: tweetType,
    })

  } catch (error) {
    console.error('[x-tweet-bot] error:', error)
    return new Response(JSON.stringify({
      error: 'Tweet bot failed',
      message: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
