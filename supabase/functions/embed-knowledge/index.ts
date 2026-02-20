// ═══════════════════════════════════════════════════════════════
// embed-knowledge — 一次性向量化所有腳本知識庫
// 呼叫：POST /functions/v1/embed-knowledge（service role key）
// MCP 主權 OS | 台灣專利 115100981 | 小路光有限公司 | 許竣翔
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY')!

const NVIDIA_EMBED_URL = 'https://integrate.api.nvidia.com/v1/embeddings'
const EMBED_MODEL = 'nvidia/nv-embedqa-e5-v5'  // 1024 dims
const BATCH_SIZE = 5  // NVIDIA API rate limit 保護

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── NVIDIA 向量化 ──────────────────────────────────────────────
async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(NVIDIA_EMBED_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text.slice(0, 2048),  // NVIDIA token limit
      input_type: 'passage',       // passage for storage, query for search
      encoding_format: 'float',
      truncate: 'END',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`NVIDIA embedding error: ${res.status} — ${err}`)
  }

  const data = await res.json()
  return data.data[0].embedding as number[]
}

// ─── Main Handler ───────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. 讀取所有未向量化的腳本
    const { data: rows, error: fetchErr } = await supabase
      .from('seobaike_knowledge')
      .select('id, content, category, section')
      .eq('is_embedded', false)
      .order('priority', { ascending: true })

    if (fetchErr) throw fetchErr
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({
        status: 'complete',
        message: '所有腳本已向量化',
        embedded: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[embed-knowledge] 待向量化：${rows.length} 筆`)

    let success = 0
    let failed = 0
    const errors: string[] = []

    // 2. 分批向量化
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)

      for (const row of batch) {
        try {
          const embedding = await getEmbedding(row.content)

          const { error: updateErr } = await supabase
            .from('seobaike_knowledge')
            .update({
              embedding,
              is_embedded: true,
            })
            .eq('id', row.id)

          if (updateErr) throw updateErr
          success++
          console.log(`[embed-knowledge] ✅ ${row.category}/${row.section} (${i + 1}/${rows.length})`)

        } catch (e) {
          failed++
          errors.push(`${row.id}: ${e.message}`)
          console.error(`[embed-knowledge] ❌ ${row.id}:`, e.message)
        }
      }

      // Rate limit 保護：每批次間隔 500ms
      if (i + BATCH_SIZE < rows.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    return new Response(JSON.stringify({
      status: 'done',
      total: rows.length,
      success,
      failed,
      errors: errors.slice(0, 10),
      model: EMBED_MODEL,
      patent: '115100981',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[embed-knowledge] Fatal:', err)
    return new Response(JSON.stringify({
      status: 'error',
      error: err.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
