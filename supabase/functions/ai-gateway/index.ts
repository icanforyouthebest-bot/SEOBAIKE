import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_SYSTEM_PROMPT = `你是 BAIKE，由 SEOBAIKE (aiforseo.vip) 打造的 AI 管理助手。
風格：專業親切，像很懂的顧問在跟客戶交流。
語言：繁體中文，自然口吻。簡潔有力，不廢話。
你的回答必須嚴格限制在客戶綁定的行業範圍內。
每次回覆最後署名「— BAIKE AI」。`

// ============================================================
// Provider 定義 (9 個 OpenAI 相容 provider)
// 優先順序：NVIDIA → Groq → DeepSeek → Together → Fireworks → OpenAI → Mistral → xAI → OpenRouter
//
// 選擇原因：全部走 OpenAI /v1/chat/completions 相容格式，不需額外 adapter。
// 排除名單：
//   - Anthropic / Cohere → 訊息格式不同，需額外轉換層
//   - Perplexity → 搜尋增強型，不適合客服對話場景
// 9 個 provider 同時掛掉機率趨近零，確保高可用。
// ============================================================
interface Provider {
  name: string
  url: string
  envKey: string
  model: string
}

const PROVIDERS: Provider[] = [
  // #1 NVIDIA — 主力，免費額度大、Llama 3.3 70B 品質穩定
  {
    name: 'nvidia',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    envKey: 'NVIDIA_API_KEY',
    model: 'meta/llama-3.3-70b-instruct',
  },
  // #2 Groq — 最快 (LPU 推論)，延遲極低，適合第一備援
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
  },
  // #3 DeepSeek — 最便宜，中文能力強，性價比高
  {
    name: 'deepseek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    envKey: 'DEEPSEEK_API_KEY',
    model: 'deepseek-chat',
  },
  // #4 Together — Llama 生態主力託管商，模型齊全
  {
    name: 'together',
    url: 'https://api.together.xyz/v1/chat/completions',
    envKey: 'TOGETHER_API_KEY',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  // #5 Fireworks — 低延遲推論平台，Llama 系列優化好
  {
    name: 'fireworks',
    url: 'https://api.fireworks.ai/inference/v1/chat/completions',
    envKey: 'FIREWORKS_API_KEY',
    model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  },
  // #6 OpenAI — 品質最高但成本也最高，作為中段備援
  {
    name: 'openai',
    url: 'https://api.openai.com/v1/chat/completions',
    envKey: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini',
  },
  // #7 Mistral — 歐洲節點，多一條地理備援路線
  {
    name: 'mistral',
    url: 'https://api.mistral.ai/v1/chat/completions',
    envKey: 'MISTRAL_API_KEY',
    model: 'mistral-small-latest',
  },
  // #8 xAI — Grok 模型，獨立基礎設施，不受主流雲端影響
  {
    name: 'xai',
    url: 'https://api.x.ai/v1/chat/completions',
    envKey: 'XAI_API_KEY',
    model: 'grok-2-latest',
  },
  // #9 OpenRouter — 兜底，本身聚合 200+ 模型，掛了代表全世界都掛了
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    envKey: 'OPENROUTER_API_KEY',
    model: 'meta-llama/llama-3.3-70b-instruct',
  },
]

// ============================================================
// 統一 callProvider 函數
// ============================================================
interface ProviderResult {
  ok: boolean
  reply: string
  provider: string
  model: string
  latencyMs: number
  error?: string
}

const PROVIDER_TIMEOUT_MS = 6_000

async function callProvider(
  provider: Provider,
  messages: { role: string; content: string }[],
  deadline: number,
): Promise<ProviderResult> {
  const apiKey = Deno.env.get(provider.envKey)
  if (!apiKey) {
    return {
      ok: false,
      reply: '',
      provider: provider.name,
      model: provider.model,
      latencyMs: 0,
      error: `${provider.envKey} not configured`,
    }
  }

  // 取剩餘時間與 per-provider timeout 的較小值
  const remaining = deadline - Date.now()
  if (remaining <= 500) {
    return {
      ok: false,
      reply: '',
      provider: provider.name,
      model: provider.model,
      latencyMs: 0,
      error: 'deadline exceeded',
    }
  }
  const timeout = Math.min(PROVIDER_TIMEOUT_MS, remaining)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const start = Date.now()

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
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal: controller.signal,
    })

    const latencyMs = Date.now() - start

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown')
      return {
        ok: false,
        reply: '',
        provider: provider.name,
        model: provider.model,
        latencyMs,
        error: `HTTP ${res.status}: ${errText.substring(0, 200)}`,
      }
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || ''

    if (!reply) {
      return {
        ok: false,
        reply: '',
        provider: provider.name,
        model: provider.model,
        latencyMs,
        error: 'empty reply from provider',
      }
    }

    return { ok: true, reply, provider: provider.name, model: provider.model, latencyMs }
  } catch (err) {
    const latencyMs = Date.now() - start
    const msg = err instanceof DOMException && err.name === 'AbortError'
      ? `timeout after ${timeout}ms`
      : (err as Error).message
    return {
      ok: false,
      reply: '',
      provider: provider.name,
      model: provider.model,
      latencyMs,
      error: msg,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================
// Main handler
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, user_id, platform, platform_user_id, model } = await req.json()

    if (!message || !platform_user_id) {
      return jsonResponse(400, { error: 'message and platform_user_id are required' })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ============================================================
    // Step 1: 約束檢查 — constrained_ai_chat()
    // ============================================================
    const { data: constraint, error: constraintError } = await supabase.rpc('constrained_ai_chat', {
      p_platform_user_id: platform_user_id,
      p_platform: platform || 'web',
      p_message: message,
    })

    if (constraintError) {
      console.error('Constraint check error:', constraintError)
      return jsonResponse(500, {
        error: 'Constraint check failed',
        detail: constraintError.message,
      })
    }

    // 約束拒絕 → 寫入 ai_customer_logs 後直接回傳，不呼叫 AI
    if (!constraint.allowed) {
      await supabase.from('ai_customer_logs').insert({
        session_id: constraint.session_id,
        user_id: user_id || null,
        role: 'chat',
        message: message.substring(0, 200),
        input_text: message.substring(0, 500),
        output_text: constraint.reason || 'blocked by constraint',
        status: 'blocked',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
      })

      return jsonResponse(200, {
        allowed: false,
        constrained: true,
        reason: constraint.reason,
        error_code: constraint.error_code,
        industry: constraint.bound_industry || null,
        session_id: constraint.session_id,
      })
    }

    // ============================================================
    // Step 2: Smart Routing — Fallback 迴圈
    // ============================================================
    const systemPrompt = BASE_SYSTEM_PROMPT + '\n\n' + constraint.system_prompt_addon
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ]

    // 如果前端指定 model，讓 NVIDIA 用指定的 model
    const providers = PROVIDERS.map((p, i) =>
      i === 0 && model ? { ...p, model } : p
    )

    const DEADLINE = Date.now() + 20_000 // 整體 20 秒 deadline
    const attempts: { provider: string; error: string; latencyMs: number }[] = []
    let result: ProviderResult | null = null

    for (const provider of providers) {
      const r = await callProvider(provider, messages, DEADLINE)
      if (r.ok) {
        result = r
        break
      }
      console.error(`[ai-gateway] ${provider.name} failed: ${r.error} (${r.latencyMs}ms)`)
      attempts.push({ provider: provider.name, error: r.error!, latencyMs: r.latencyMs })

      // deadline 已到就不再嘗試
      if (Date.now() >= DEADLINE - 500) break
    }

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null
    const usedFallback = attempts.length > 0

    // ============================================================
    // Step 2a: 全部失敗 → 502
    // ============================================================
    if (!result) {
      // 更新 audit trail（失敗）
      if (constraint.audit_id) {
        await supabase.rpc('update_ai_audit', {
          p_audit_id: constraint.audit_id,
          p_output_summary: `All ${attempts.length} providers failed`,
          p_status: 'failed',
        })
      }

      // 寫入 ai_customer_logs（失敗紀錄）
      await supabase.from('ai_customer_logs').insert({
        session_id: constraint.session_id,
        user_id: user_id || null,
        role: 'chat',
        message: message.substring(0, 200),
        input_text: message.substring(0, 500),
        output_text: `All providers failed: ${attempts.map(a => a.provider).join(', ')}`,
        status: 'error',
        ip_address: clientIp,
      })

      return jsonResponse(502, {
        error: 'All AI providers failed',
        attempts: attempts.map(a => ({ provider: a.provider, error: a.error })),
        constrained: true,
        allowed: true,
        session_id: constraint.session_id,
      })
    }

    // ============================================================
    // Step 3: 成功 — 更新 audit trail
    // ============================================================
    if (constraint.audit_id) {
      await supabase.rpc('update_ai_audit', {
        p_audit_id: constraint.audit_id,
        p_output_summary: result.reply.substring(0, 500),
        p_status: 'success',
      })
    }

    // ============================================================
    // Step 3.5: 寫入 ai_customer_logs（老闆戰情室用）
    // ============================================================
    await supabase.from('ai_customer_logs').insert({
      session_id: constraint.session_id,
      user_id: user_id || null,
      role: 'chat',
      message: message.substring(0, 200),
      input_text: message.substring(0, 500),
      output_text: result.reply.substring(0, 500),
      status: 'success',
      ip_address: clientIp,
      response: { provider: result.provider, model: result.model, latencyMs: result.latencyMs },
    })

    // ============================================================
    // Step 3.6: Fallback 發生時 → 寫入 system_health_checks
    // ============================================================
    if (usedFallback) {
      console.warn(`[ai-gateway] Fallback triggered: tried ${attempts.map(a => a.provider).join(' → ')} → landed on ${result.provider}`)
      const { error: healthErr } = await supabase.from('system_health_checks').insert({
        check_type: 'ai_fallback',
        component: 'ai-gateway',
        status: 'degraded',
        response_ms: result.latencyMs,
        details: {
          landed_on: result.provider,
          landed_model: result.model,
          latencyMs: result.latencyMs,
          failed_providers: attempts,
          session_id: constraint.session_id,
        },
        checked_at: new Date().toISOString(),
      })
      if (healthErr) {
        // system_health_checks 寫入失敗不影響主流程
        console.error('[ai-gateway] Failed to log health check:', healthErr.message)
      }
    }

    // ============================================================
    // Step 4: 回傳（向下相容 + 新增 provider/fallback 欄位）
    // ============================================================
    return jsonResponse(200, {
      allowed: true,
      constrained: true,
      reply: result.reply,
      industry: constraint.industry_name_zh,
      session_id: constraint.session_id,
      model: result.model,
      provider: result.provider,
      fallback: usedFallback,
      ...(usedFallback ? { failed_providers: attempts.map(a => a.provider) } : {}),
    })

  } catch (error) {
    console.error('ai-gateway error:', error)
    return jsonResponse(500, {
      error: 'Internal error',
      message: (error as Error).message,
    })
  }
})

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
