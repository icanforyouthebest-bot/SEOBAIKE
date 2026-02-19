import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = req.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return json(401, { error: 'Unauthorized' })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      auth.replace('Bearer ', '')
    )
    if (authErr || !user) return json(401, { error: 'Invalid token' })

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''

    // ============================================================
    // analyze — 接收文字內容，執行 AI 分析，扣點，回傳報告
    // ============================================================
    if (action === 'analyze') {
      const body = await req.json()
      const { file_name, file_type, file_size, text_content } = body

      if (!file_name || !text_content) {
        return json(400, { error: 'file_name and text_content required' })
      }

      if (text_content.length < 10) {
        return json(400, { error: 'Content too short (min 10 chars)' })
      }

      const pointsCost = text_content.length > 5000 ? 100 : 50

      // Check credits
      let { data: credits } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!credits) {
        const { data: newCred } = await supabase
          .from('user_credits')
          .insert({ user_id: user.id, balance: 100 })
          .select()
          .single()
        credits = newCred
      }

      if (!credits || credits.balance < pointsCost) {
        return json(402, {
          error: 'Insufficient credits',
          balance: credits?.balance || 0,
          required: pointsCost,
        })
      }

      // Create report record
      const { data: report, error: insertErr } = await supabase
        .from('analysis_reports')
        .insert({
          user_id: user.id,
          file_name,
          file_type: file_type || 'txt',
          file_size: file_size || text_content.length,
          text_content: text_content.substring(0, 50000),
          status: 'processing',
          points_cost: pointsCost,
        })
        .select()
        .single()

      if (insertErr || !report) {
        return json(500, { error: 'Failed to create report', detail: insertErr?.message })
      }

      // Get World Definition nodes
      const { data: wdNodes } = await supabase
        .from('world_definition')
        .select('id, level, code, name_tw, name_us, name_eu, name_jp')
        .eq('is_active', true)
        .order('level')
        .limit(100)

      // Build prompt and call AI
      const systemPrompt = buildPrompt(wdNodes || [])
      const aiResult = await callAI(systemPrompt, text_content.substring(0, 15000), file_name)

      if (!aiResult) {
        await supabase.from('analysis_reports')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', report.id)
        return json(500, { error: 'AI analysis failed — all providers down' })
      }

      // Deduct credits
      await supabase.from('user_credits')
        .update({
          balance: credits.balance - pointsCost,
          total_used: (credits.total_used || 0) + pointsCost,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: -pointsCost,
        type: 'use',
        reference_id: report.id,
        description: `分析報告: ${file_name}`,
      })

      // Update report
      const { data: done } = await supabase
        .from('analysis_reports')
        .update({
          status: 'completed',
          industry_l1: aiResult.classification?.l1 || null,
          industry_l2: aiResult.classification?.l2 || null,
          industry_l3: aiResult.classification?.l3 || null,
          industry_l4: aiResult.classification?.l4 || null,
          cross_country: aiResult.cross_country || {},
          ai_summary: aiResult.summary || '',
          ai_full_report: aiResult,
          risk_score: aiResult.risk_score || 0,
          compliance_flags: aiResult.compliance_flags || [],
          inference_trail: aiResult.inference_trail || [],
          is_paid: true,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', report.id)
        .select()
        .single()

      return json(200, {
        report: done,
        credits_remaining: credits.balance - pointsCost,
      })
    }

    // ============================================================
    // report — 取得完整報告
    // ============================================================
    if (action === 'report') {
      const id = url.searchParams.get('id')
      if (!id) return json(400, { error: 'id required' })

      const { data: report } = await supabase
        .from('analysis_reports')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

      if (!report) return json(404, { error: 'Report not found' })
      return json(200, { report })
    }

    // ============================================================
    // list — 列出使用者所有報告
    // ============================================================
    if (action === 'list') {
      const { data: reports } = await supabase
        .from('analysis_reports')
        .select('id, file_name, file_type, status, created_at, points_cost, is_paid, industry_l1, risk_score, ai_summary')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      return json(200, { reports: reports || [] })
    }

    // ============================================================
    // credits — 查詢點數餘額
    // ============================================================
    if (action === 'credits') {
      let { data: credits } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!credits) {
        const { data: nc } = await supabase
          .from('user_credits')
          .insert({ user_id: user.id, balance: 100 })
          .select()
          .single()
        credits = nc
      }

      const { data: txns } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      return json(200, { credits, transactions: txns || [] })
    }

    return json(404, {
      error: 'Unknown action',
      actions: ['analyze', 'report', 'list', 'credits'],
    })
  } catch (error) {
    console.error('[analyze-document] error:', error)
    return json(500, { error: 'Internal error', message: (error as Error).message })
  }
})

// ============================================================
// Helpers
// ============================================================

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildPrompt(nodes: Array<{ level: number; code: string; name_tw: string; name_us: string }>) {
  const l1 = nodes.filter(n => n.level === 1).map(n => `${n.code}: ${n.name_tw} / ${n.name_us}`).join('\n')
  const l2 = nodes.filter(n => n.level === 2).map(n => `${n.code}: ${n.name_tw} / ${n.name_us}`).join('\n')

  return `You are the SEOBAIKE CaaS Analysis Engine (Patent 115100981).
You analyze documents within the World Definition L1-L4 constraint framework.

L1 Physical World (產業分類):
${l1 || 'No L1 nodes loaded'}

L2 Business Logic (商業邏輯):
${l2 || 'No L2 nodes loaded'}

L3 = Safety & Compliance assessment
L4 = Strategic Command classification

GLOBAL cross-country alignment systems (use ALL that are relevant to the document):
- INTL: ISIC Rev.4 (UN International Standard) — ALWAYS include this
- TW: 行業標準分類 (TSIC)
- US: NAICS 2022
- EU: NACE Rev.2
- JP: JSIC Rev.14
- CN: GB/T 4754-2017
- KR: KSIC Rev.10
- UK: UK SIC 2007
- DE: WZ 2008
- FR: NAF Rev.2
- IN: NIC 2008
- BR: CNAE 2.0
- AU: ANZSIC 2006
- CA: NAICS Canada 2022
- SG: SSIC 2020
- And any other relevant national system

RULES:
1. Classify the document into L1→L2→L3→L4 hierarchy
2. Provide cross-country codes for ALL relevant countries (minimum: INTL + document origin country + top 5 markets)
3. Assess risk on 0-100 scale
4. Trace your inference path at EACH level (this is the patent core)
5. Flag compliance issues per jurisdiction
6. Give actionable recommendations

Respond in this JSON (no markdown, pure JSON):
{
  "summary": "2-3 sentence summary in the document's language",
  "classification": {
    "l1": "code: name",
    "l2": "code: name",
    "l3": "safety assessment summary",
    "l4": "strategic classification"
  },
  "cross_country": {
    "intl": {"code":"ISIC code","name":"International classification","system":"ISIC Rev.4"},
    "tw": {"code":"...","name":"...","system":"TSIC"},
    "us": {"code":"...","name":"...","system":"NAICS 2022"},
    "eu": {"code":"...","name":"...","system":"NACE Rev.2"},
    "jp": {"code":"...","name":"...","system":"JSIC Rev.14"},
    "...": "include more countries as relevant"
  },
  "key_findings": ["..."],
  "risk_score": 0,
  "risk_factors": ["..."],
  "compliance_flags": ["..."],
  "inference_trail": [
    {"level":"L1","node":"...","reasoning":"..."},
    {"level":"L2","node":"...","reasoning":"..."},
    {"level":"L3","node":"...","reasoning":"..."},
    {"level":"L4","node":"...","reasoning":"..."}
  ],
  "recommendations": ["..."]
}`
}

async function callAI(systemPrompt: string, content: string, fileName: string): Promise<Record<string, unknown> | null> {
  const providers = [
    {
      name: 'nvidia',
      url: 'https://integrate.api.nvidia.com/v1/chat/completions',
      key: Deno.env.get('NVIDIA_API_KEY'),
      model: 'meta/llama-3.1-70b-instruct',
    },
    {
      name: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      key: Deno.env.get('OPENAI_API_KEY'),
      model: 'gpt-4o-mini',
    },
    {
      name: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      key: Deno.env.get('GROQ_API_KEY'),
      model: 'llama-3.1-70b-versatile',
    },
    {
      name: 'deepseek',
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: Deno.env.get('DEEPSEEK_API_KEY'),
      model: 'deepseek-chat',
    },
    {
      name: 'together',
      url: 'https://api.together.xyz/v1/chat/completions',
      key: Deno.env.get('TOGETHER_API_KEY'),
      model: 'meta-llama/Llama-3-70b-chat-hf',
    },
  ]

  const userMsg = `Analyze this document:\nFile: ${fileName}\n\nContent:\n${content}`

  for (const p of providers) {
    if (!p.key) continue
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25000)

      const res = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${p.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: p.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.2,
          max_tokens: 4000,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)
      if (!res.ok) {
        console.error(`[${p.name}] HTTP ${res.status}`)
        continue
      }

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content
      if (!text) continue

      // Parse JSON from response
      try {
        return JSON.parse(text)
      } catch {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          try { return JSON.parse(match[0]) } catch { /* skip */ }
        }
      }
      console.error(`[${p.name}] failed to parse JSON response`)
    } catch (e) {
      console.error(`[${p.name}] error:`, (e as Error).message)
      continue
    }
  }

  return null
}
