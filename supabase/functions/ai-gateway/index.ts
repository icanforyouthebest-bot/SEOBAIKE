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

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
const DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct'

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

    const nvidiaKey = Deno.env.get('NVIDIA_API_KEY')
    if (!nvidiaKey) {
      return jsonResponse(500, { error: 'NVIDIA_API_KEY not configured' })
    }

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

    // 約束拒絕 → 寫入 ai_customer_logs 後直接回傳，不呼叫 NVIDIA
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
    // Step 2: 呼叫 NVIDIA NIM API（帶行業約束 system prompt）
    // ============================================================
    const systemPrompt = BASE_SYSTEM_PROMPT + '\n\n' + constraint.system_prompt_addon

    const nvidiaRes = await fetch(NVIDIA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nvidiaKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!nvidiaRes.ok) {
      const errText = await nvidiaRes.text()
      console.error('NVIDIA API error:', nvidiaRes.status, errText)

      // 更新 audit trail（失敗）
      if (constraint.audit_id) {
        await supabase.rpc('update_ai_audit', {
          p_audit_id: constraint.audit_id,
          p_output_summary: `NVIDIA API error: ${nvidiaRes.status}`,
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
        output_text: `NVIDIA API error: ${nvidiaRes.status}`,
        status: 'error',
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
      })

      return jsonResponse(502, {
        error: 'NVIDIA API error',
        status: nvidiaRes.status,
        constrained: true,
        allowed: true,
        session_id: constraint.session_id,
      })
    }

    const nvidiaData = await nvidiaRes.json()
    const reply = nvidiaData.choices?.[0]?.message?.content || '抱歉，AI 暫時無法回應。\n\n— BAIKE AI'

    // ============================================================
    // Step 3: 更新 audit trail（成功）
    // ============================================================
    if (constraint.audit_id) {
      await supabase.rpc('update_ai_audit', {
        p_audit_id: constraint.audit_id,
        p_output_summary: reply.substring(0, 500),
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
      output_text: reply.substring(0, 500),
      status: 'success',
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
    })

    // ============================================================
    // Step 4: 回傳
    // ============================================================
    return jsonResponse(200, {
      allowed: true,
      constrained: true,
      reply,
      industry: constraint.industry_name_zh,
      session_id: constraint.session_id,
      model: model || DEFAULT_MODEL,
    })

  } catch (error) {
    console.error('ai-gateway error:', error)
    return jsonResponse(500, {
      error: 'Internal error',
      message: error.message,
    })
  }
})

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
