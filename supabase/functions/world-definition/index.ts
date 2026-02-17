import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// World Definition API — 架構即法律
// 唯讀 API：工程師只能查，不能改
// 驗證推理路徑、查詢節點、搜尋跨國對齊
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 驗證：必須攜帶 Authorization Bearer token
    // 實際金鑰驗證由 Supabase Gateway 或 INTERNAL_API_KEY 處理
    const auth = req.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Unauthorized: Bearer token required' })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''

    // ============================================================
    // validate-path — 驗證推理路徑是否合法
    // ============================================================
    if (action === 'validate-path') {
      const { from_node_id, to_node_id } = await req.json()

      if (!from_node_id || !to_node_id) {
        return jsonResponse(400, { error: 'from_node_id and to_node_id required' })
      }

      // 查詢禁止路徑
      const { data: forbidden } = await supabase
        .from('forbidden_inference_paths')
        .select('*')
        .eq('from_node_id', from_node_id)
        .eq('to_node_id', to_node_id)
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString().split('T')[0])
        .or(`valid_to.is.null,valid_to.gte.${new Date().toISOString().split('T')[0]}`)
        .limit(1)
        .maybeSingle()

      if (forbidden) {
        // 記錄違規
        await supabase.from('inference_violations').insert({
          from_node: from_node_id,
          to_node: to_node_id,
          reason: forbidden.reason || 'forbidden path',
          source: 'world-definition-api',
        })

        return jsonResponse(200, {
          allowed: false,
          reason: forbidden.reason || 'Path is explicitly forbidden',
          path: 'forbidden',
        })
      }

      // 查詢允許路徑
      const { data: allowed } = await supabase
        .from('allowed_inference_paths')
        .select('*')
        .eq('from_node_id', from_node_id)
        .eq('to_node_id', to_node_id)
        .eq('is_active', true)
        .lte('valid_from', new Date().toISOString().split('T')[0])
        .or(`valid_to.is.null,valid_to.gte.${new Date().toISOString().split('T')[0]}`)
        .limit(1)
        .maybeSingle()

      return jsonResponse(200, {
        allowed: !!allowed,
        max_hops: allowed?.max_hops || 0,
        path: allowed ? 'allowed' : 'unknown',
      })
    }

    // ============================================================
    // get-node — 取得節點資訊
    // ============================================================
    if (action === 'get-node') {
      const nodeId = url.searchParams.get('id')
      if (!nodeId) {
        return jsonResponse(400, { error: 'id parameter required' })
      }

      const { data: node } = await supabase
        .from('world_definition')
        .select('*')
        .eq('id', nodeId)
        .eq('is_active', true)
        .single()

      if (!node) {
        return jsonResponse(404, { error: 'Node not found or inactive' })
      }

      return jsonResponse(200, node)
    }

    // ============================================================
    // search-nodes — 搜尋節點（跨國對齊）
    // ============================================================
    if (action === 'search-nodes') {
      const body = await req.json()
      const { keyword, country, level } = body

      if (!keyword) {
        return jsonResponse(400, { error: 'keyword required' })
      }

      let query = supabase
        .from('world_definition')
        .select('*')
        .eq('is_active', true)

      // 根據國家搜尋對應名稱欄位
      const countryField: Record<string, string> = {
        tw: 'name_tw',
        us: 'name_us',
        eu: 'name_eu',
        jp: 'name_jp',
      }

      const field = countryField[country || 'tw'] || 'name_tw'
      query = query.ilike(field, `%${keyword}%`)

      if (level) {
        query = query.eq('level', level)
      }

      const { data: nodes } = await query.limit(10)

      return jsonResponse(200, {
        results: nodes || [],
        count: nodes?.length || 0,
        search: { keyword, country: country || 'tw', level: level || null },
      })
    }

    // ============================================================
    // get-tree — 取得完整層級樹
    // ============================================================
    if (action === 'get-tree') {
      const level = url.searchParams.get('level')

      let query = supabase
        .from('world_definition')
        .select('*')
        .eq('is_active', true)
        .order('level')
        .order('code')

      if (level) {
        query = query.eq('level', parseInt(level))
      }

      const { data: nodes } = await query.limit(500)

      return jsonResponse(200, {
        nodes: nodes || [],
        count: nodes?.length || 0,
      })
    }

    // ============================================================
    // list-paths — 列出所有允許/禁止路徑
    // ============================================================
    if (action === 'list-paths') {
      const pathType = url.searchParams.get('type') || 'all'

      const result: Record<string, unknown> = {}

      if (pathType === 'all' || pathType === 'allowed') {
        const { data: allowed } = await supabase
          .from('allowed_inference_paths')
          .select('*, from_node:world_definition!from_node_id(code, name_tw), to_node:world_definition!to_node_id(code, name_tw)')
          .eq('is_active', true)
          .limit(100)
        result.allowed = allowed || []
      }

      if (pathType === 'all' || pathType === 'forbidden') {
        const { data: forbidden } = await supabase
          .from('forbidden_inference_paths')
          .select('*, from_node:world_definition!from_node_id(code, name_tw), to_node:world_definition!to_node_id(code, name_tw)')
          .eq('is_active', true)
          .limit(100)
        result.forbidden = forbidden || []
      }

      return jsonResponse(200, result)
    }

    // ============================================================
    // violations — 查詢違規記錄
    // ============================================================
    if (action === 'violations') {
      const limit = parseInt(url.searchParams.get('limit') || '20')

      const { data: violations } = await supabase
        .from('inference_violations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      return jsonResponse(200, {
        violations: violations || [],
        count: violations?.length || 0,
      })
    }

    return jsonResponse(404, {
      error: 'Unknown action',
      available_actions: ['validate-path', 'get-node', 'search-nodes', 'get-tree', 'list-paths', 'violations'],
    })

  } catch (error) {
    console.error('[world-definition] error:', error)
    return jsonResponse(500, {
      error: 'Internal error',
      message: (error as Error).message,
    })
  }
})

function jsonResponse(status: number, body: Record<string, unknown> | unknown[]) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
