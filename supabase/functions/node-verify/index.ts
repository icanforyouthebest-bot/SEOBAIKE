// ═══════════════════════════════════════════════════════════════
// node-verify — L1-L4 工業節點路徑驗證 API
// 台灣專利 115100981 | 小路光有限公司 | 許竣翔
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'verify'
    const body = req.method === 'POST' ? await req.json() : {}

    // ── 1. 驗證 L1→L2→L3→L4 路徑 ──────────────────────────────
    if (action === 'verify') {
      const { session_id, l1_id, l2_id, l3_id, l4_id, context } = body

      if (!session_id || !l1_id) {
        return new Response(JSON.stringify({
          error: 'session_id 和 l1_id 為必填欄位',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase.rpc('check_inference_path', {
        p_session_id: session_id,
        p_l1_id: l1_id,
        p_l2_id: l2_id || null,
        p_l3_id: l3_id || null,
        p_l4_id: l4_id || null,
        p_context: context || {},
      })

      if (error) throw error

      return new Response(JSON.stringify({
        verdict: data?.verdict || 'denied',
        reason: data?.reason,
        check_id: data?.check_id,
        matched_path_id: data?.matched_path_id,
        drift_type: data?.drift_type,
        patent: '115100981',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 2. 查詢節點詳情 ──────────────────────────────────────────
    if (action === 'node') {
      const id = url.searchParams.get('id') || body.id
      const level = url.searchParams.get('level') || body.level  // L1|L2|L3|L4

      const tableMap: Record<string, string> = {
        L1: 'l1_categories',
        L2: 'l2_subcategories',
        L3: 'l3_processes',
        L4: 'l4_nodes',
      }
      const table = tableMap[level?.toUpperCase() || '']

      if (!table) {
        return new Response(JSON.stringify({ error: 'level 必須是 L1/L2/L3/L4' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
      if (error) throw error

      return new Response(JSON.stringify({ node: data, level, patent: '115100981' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── 3. 搜尋節點 ──────────────────────────────────────────────
    if (action === 'search') {
      const keyword = url.searchParams.get('q') || body.q || ''
      const level = url.searchParams.get('level') || body.level

      const tables = level
        ? [{ L1: 'l1_categories', L2: 'l2_subcategories', L3: 'l3_processes', L4: 'l4_nodes' }[level.toUpperCase()]]
        : ['l1_categories', 'l2_subcategories', 'l3_processes', 'l4_nodes']

      const results: any[] = []
      for (const table of tables.filter(Boolean)) {
        const { data } = await supabase
          .from(table!)
          .select('id, code, name_zh, name_en')
          .or(`name_zh.ilike.%${keyword}%,name_en.ilike.%${keyword}%,code.ilike.%${keyword}%`)
          .limit(10)
        if (data) results.push(...data.map(d => ({ ...d, table })))
      }

      return new Response(JSON.stringify({ results, total: results.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── 4. 取得全層樹狀結構 ────────────────────────────────────
    if (action === 'tree') {
      const { data: l1 } = await supabase.from('l1_categories').select('id, code, name_zh, name_en').order('code')
      const { data: l2 } = await supabase.from('l2_subcategories').select('id, l1_id, code, name_zh, name_en').order('code')
      const { data: l3 } = await supabase.from('l3_processes').select('id, l2_id, code, name_zh, name_en').order('code')
      const { data: l4 } = await supabase.from('l4_nodes').select('id, l3_id, code, name_zh, name_en').order('code')

      return new Response(JSON.stringify({
        tree: { l1, l2, l3, l4 },
        counts: { l1: l1?.length, l2: l2?.length, l3: l3?.length, l4: l4?.length },
        patent: '115100981',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 5. 違規記錄查詢 ────────────────────────────────────────
    if (action === 'violations') {
      const { data, error } = await supabase
        .from('inference_violations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error

      return new Response(JSON.stringify({ violations: data, count: data?.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      error: '未知 action',
      valid_actions: ['verify', 'node', 'search', 'tree', 'violations'],
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[node-verify] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
