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
    // 驗證：必須攜帶合法 Authorization Bearer token (JWT)
    // 解析 JWT payload 驗證 role 為 service_role 或 anon
    const auth = req.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return jsonResponse(401, { error: 'Unauthorized: Bearer token required' })
    }
    const token = auth.replace('Bearer ', '')
    try {
      const parts = token.split('.')
      if (parts.length !== 3) throw new Error('not a JWT')
      const payload = JSON.parse(atob(parts[1]))
      const validRoles = ['service_role', 'anon']
      if (!payload.role || !validRoles.includes(payload.role)) {
        return jsonResponse(403, { error: 'Forbidden: invalid role' })
      }
      // 驗證 JWT 是否為此 project 的 token
      const projectRef = Deno.env.get('SUPABASE_URL')?.match(/\/\/([^.]+)/)?.[1]
      if (projectRef && payload.ref !== projectRef) {
        return jsonResponse(403, { error: 'Forbidden: token project mismatch' })
      }
    } catch {
      return jsonResponse(403, { error: 'Forbidden: invalid token format' })
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

      if (!keyword || typeof keyword !== 'string') {
        return jsonResponse(400, { error: 'keyword required (string)' })
      }

      // V-008: 全球國家代碼 (不再限制 4 國)
      const countryField: Record<string, string> = {
        tw: 'name_tw', us: 'name_us', eu: 'name_eu', jp: 'name_jp',
        cn: 'name_cn', kr: 'name_kr', uk: 'name_uk', de: 'name_de',
        fr: 'name_fr', in: 'name_in', br: 'name_br', au: 'name_au',
        ca: 'name_ca', sg: 'name_sg', hk: 'name_hk', th: 'name_th',
        vn: 'name_vn', id: 'name_id', my: 'name_my', ph: 'name_ph',
        mx: 'name_mx', sa: 'name_sa', ae: 'name_ae', il: 'name_il',
        intl: 'name_us', // ISIC fallback to English
      }
      // 未知國家碼 fallback 到 name_tw 搜尋
      if (country && !countryField[country]) {
        // 不拒絕，fallback 全文搜尋
      }

      // V-002: 過濾 ILIKE 特殊字元，防止萬用字元枚舉
      const sanitized = keyword.replace(/[%_\\]/g, '\\$&')
      if (sanitized.length < 1) {
        return jsonResponse(400, { error: 'keyword too short after sanitization' })
      }

      let query = supabase
        .from('world_definition')
        .select('*')
        .eq('is_active', true)

      const field = countryField[country || 'tw'] || 'name_tw'
      query = query.ilike(field, `%${sanitized}%`)

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

    // ============================================================
    // get-graph — D3.js 相容的節點/連結圖資料
    // ============================================================
    if (action === 'get-graph') {
      const { data: nodes } = await supabase
        .from('world_definition')
        .select('id, level, code, name_tw, name_us, parent_id')
        .eq('is_active', true)
        .order('level')
        .order('code')

      const { data: allowed } = await supabase
        .from('allowed_inference_paths')
        .select('from_node_id, to_node_id, max_hops')
        .eq('is_active', true)

      const { data: forbidden } = await supabase
        .from('forbidden_inference_paths')
        .select('from_node_id, to_node_id, reason')
        .eq('is_active', true)

      // D3 format: nodes + links
      const d3Nodes = (nodes || []).map(n => ({
        id: n.id,
        label: n.name_tw,
        code: n.code,
        level: n.level,
        parent: n.parent_id,
        group: n.level,
      }))

      const d3Links = [
        // Parent-child hierarchy links
        ...(nodes || []).filter(n => n.parent_id).map(n => ({
          source: n.parent_id,
          target: n.id,
          type: 'hierarchy',
        })),
        // Allowed paths (green)
        ...(allowed || []).map(a => ({
          source: a.from_node_id,
          target: a.to_node_id,
          type: 'allowed',
          max_hops: a.max_hops,
        })),
        // Forbidden paths (red)
        ...(forbidden || []).map(f => ({
          source: f.from_node_id,
          target: f.to_node_id,
          type: 'forbidden',
          reason: f.reason,
        })),
      ]

      return jsonResponse(200, {
        nodes: d3Nodes,
        links: d3Links,
        stats: {
          total_nodes: d3Nodes.length,
          l1: d3Nodes.filter(n => n.level === 1).length,
          l2: d3Nodes.filter(n => n.level === 2).length,
          l3: d3Nodes.filter(n => n.level === 3).length,
          l4: d3Nodes.filter(n => n.level === 4).length,
          allowed_paths: (allowed || []).length,
          forbidden_paths: (forbidden || []).length,
        },
      })
    }

    // ============================================================
    // stats — 系統統計儀表板
    // ============================================================
    if (action === 'stats') {
      const { count: totalNodes } = await supabase.from('world_definition').select('*', { count: 'exact', head: true }).eq('is_active', true)
      const { count: l1 } = await supabase.from('world_definition').select('*', { count: 'exact', head: true }).eq('level', 1).eq('is_active', true)
      const { count: l2 } = await supabase.from('world_definition').select('*', { count: 'exact', head: true }).eq('level', 2).eq('is_active', true)
      const { count: l3 } = await supabase.from('world_definition').select('*', { count: 'exact', head: true }).eq('level', 3).eq('is_active', true)
      const { count: l4 } = await supabase.from('world_definition').select('*', { count: 'exact', head: true }).eq('level', 4).eq('is_active', true)
      const { count: allowedPaths } = await supabase.from('allowed_inference_paths').select('*', { count: 'exact', head: true }).eq('is_active', true)
      const { count: forbiddenPaths } = await supabase.from('forbidden_inference_paths').select('*', { count: 'exact', head: true }).eq('is_active', true)
      const { count: violations } = await supabase.from('inference_violations').select('*', { count: 'exact', head: true })

      return jsonResponse(200, {
        total_nodes: totalNodes,
        levels: { l1, l2, l3, l4 },
        paths: { allowed: allowedPaths, forbidden: forbiddenPaths },
        violations,
        countries: [
          'TW','US','EU','JP','CN','KR','UK','DE','FR','IN','BR','AU',
          'CA','SG','HK','TH','VN','ID','MY','PH','MX','SA','AE','IL'
        ],
        classification_systems: {
          INTL: 'ISIC Rev.4 (UN International Standard)',
          TW: '行業標準分類 (TSIC)',
          US: 'NAICS 2022',
          EU: 'NACE Rev.2',
          JP: 'JSIC Rev.14 (日本標準産業分類)',
          CN: 'GB/T 4754-2017 (國民經濟行業分類)',
          KR: 'KSIC Rev.10 (한국표준산업분류)',
          UK: 'UK SIC 2007',
          DE: 'WZ 2008 (Klassifikation der Wirtschaftszweige)',
          FR: 'NAF Rev.2 (Nomenclature d\'activités française)',
          IN: 'NIC 2008 (National Industrial Classification)',
          BR: 'CNAE 2.0 (Classificação Nacional de Atividades Econômicas)',
          AU: 'ANZSIC 2006 (Australian and New Zealand Standard)',
          CA: 'NAICS Canada 2022',
          SG: 'SSIC 2020 (Singapore Standard)',
          HK: 'HSIC (Hong Kong Standard)',
          TH: 'TSIC 2009 (Thailand Standard)',
          VN: 'VSIC 2018 (Vietnam Standard)',
          ID: 'KBLI 2020 (Klasifikasi Baku Lapangan Usaha Indonesia)',
          MY: 'MSIC 2008 (Malaysia Standard)',
          PH: 'PSIC 2009 (Philippine Standard)',
          MX: 'SCIAN 2023 (Sistema de Clasificación Industrial)',
          SA: 'ISIC-SA (Saudi Arabia)',
          AE: 'ISIC-AE (United Arab Emirates)',
          IL: 'CBS Classification (Israel)',
        },
      })
    }

    // ============================================================
    // latency-monitor — 全球延遲監控儀表板
    // ============================================================
    if (action === 'latency-monitor') {
      const hours = parseInt(url.searchParams.get('hours') || '24')
      const since = new Date(Date.now() - hours * 3600_000).toISOString()

      const { data: stats } = await supabase
        .from('inference_path_stats')
        .select('provider, region, latency_ms, success, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500)

      // 按 region 聚合
      const byRegion: Record<string, { count: number; avg_ms: number; p95_ms: number; providers: Record<string, number> }> = {}
      const byProvider: Record<string, { count: number; avg_ms: number; failures: number }> = {}

      for (const s of (stats || [])) {
        // Region aggregation
        if (!byRegion[s.region]) byRegion[s.region] = { count: 0, avg_ms: 0, p95_ms: 0, providers: {} }
        const r = byRegion[s.region]
        r.avg_ms = (r.avg_ms * r.count + (s.latency_ms || 0)) / (r.count + 1)
        r.count++
        r.providers[s.provider] = (r.providers[s.provider] || 0) + 1

        // Provider aggregation
        if (!byProvider[s.provider]) byProvider[s.provider] = { count: 0, avg_ms: 0, failures: 0 }
        const p = byProvider[s.provider]
        p.avg_ms = (p.avg_ms * p.count + (s.latency_ms || 0)) / (p.count + 1)
        p.count++
        if (!s.success) p.failures++
      }

      // Calculate P95 per region
      for (const region of Object.keys(byRegion)) {
        const regionLatencies = (stats || [])
          .filter(s => s.region === region)
          .map(s => s.latency_ms || 0)
          .sort((a, b) => a - b)
        const idx = Math.floor(regionLatencies.length * 0.95)
        byRegion[region].p95_ms = regionLatencies[idx] || 0
        byRegion[region].avg_ms = Math.round(byRegion[region].avg_ms)
      }
      for (const p of Object.keys(byProvider)) {
        byProvider[p].avg_ms = Math.round(byProvider[p].avg_ms)
      }

      return jsonResponse(200, {
        period_hours: hours,
        since,
        total_requests: (stats || []).length,
        by_region: byRegion,
        by_provider: byProvider,
      })
    }

    return jsonResponse(404, {
      error: 'Unknown action',
      available_actions: ['validate-path', 'get-node', 'search-nodes', 'get-tree', 'list-paths', 'violations', 'get-graph', 'stats', 'latency-monitor'],
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
