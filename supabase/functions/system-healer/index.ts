import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type InferencePath = {
    l1?: string | number
    l2?: string | number
    l3?: string | number
    l4?: string | number
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-inference-path',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

async function checkInferencePath(supabase: SupabaseClient, path: InferencePath) {
    // Expect a provided L1-L4 mapping in header body or JSON payload.
    // If any level is missing or FK relationship doesn't match, return false.
    if (!path.l1 || !path.l2 || !path.l3 || !path.l4) return { status: 'not_found' }

    // Try resolve L1
    const { data: l1Rows, error: l1Err } = await supabase
        .from('l1_categories')
        .select('id')
        .or(`id.eq.${path.l1},tsic_code.eq.${path.l1},naics_code.eq.${path.l1}`)
        .limit(1)

    if (l1Err || !l1Rows || l1Rows.length === 0) return { status: 'denied' }
    const l1Id = l1Rows[0].id

    // Resolve L2 and ensure fk -> L1
    const { data: l2Rows, error: l2Err } = await supabase
        .from('l2_subcategories')
        .select('id,l1_id')
        .or(`id.eq.${path.l2},tsic_code.eq.${path.l2},naics_code.eq.${path.l2}`)
        .limit(1)

    if (l2Err || !l2Rows || l2Rows.length === 0) return { status: 'denied' }
    if (l2Rows[0].l1_id !== l1Id) return { status: 'halted' }
    const l2Id = l2Rows[0].id

    // Resolve L3 and ensure fk -> L2
    const { data: l3Rows, error: l3Err } = await supabase
        .from('l3_processes')
        .select('id,l2_id')
        .or(`id.eq.${path.l3},tsic_code.eq.${path.l3},naics_code.eq.${path.l3}`)
        .limit(1)

    if (l3Err || !l3Rows || l3Rows.length === 0) return { status: 'denied' }
    if (l3Rows[0].l2_id !== l2Id) return { status: 'halted' }
    const l3Id = l3Rows[0].id

    // Resolve L4 and ensure fk -> L3
    const { data: l4Rows, error: l4Err } = await supabase
        .from('l4_nodes')
        .select('id,l3_id')
        .or(`id.eq.${path.l4},tsic_code.eq.${path.l4},naics_code.eq.${path.l4}`)
        .limit(1)

    if (l4Err || !l4Rows || l4Rows.length === 0) return { status: 'denied' }
    if (l4Rows[0].l3_id !== l3Id) return { status: 'halted' }

    return { status: 'allowed' }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const start = Date.now()
    const issues: string[] = []
    const fixed: string[] = []

    try {
        // Require inference path header (JSON) and validate before any action
        const inferenceHeader = req.headers.get('x-inference-path')
        let inferencePath: InferencePath = {}

        if (inferenceHeader) {
            try {
                inferencePath = JSON.parse(inferenceHeader)
            } catch {
                // ignore parse error, will be denied below
            }
        } else {
            // also allow path in JSON body
            try {
                const body = await req.json().catch(() => ({}))
                if (body?.inference_path) inferencePath = body.inference_path
            } catch {
                // ignore
            }
        }

        const check = await checkInferencePath(supabase, inferencePath)
        if (check.status !== 'allowed') {
            return new Response(JSON.stringify({
                success: false,
                reason: 'inference_path_validation_failed',
                detail: check.status
            }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 1. 檢查節點健康
        const { data: nodes, error: nodesErr } = await supabase
            .from('node_network')
            .select('node_id, is_active, last_active_at')
            .eq('is_active', true)

        if (nodesErr) throw nodesErr

        // 2. 偵測失活節點（超過24小時沒活動）
        const staleNodes = (nodes || []).filter((n: any) => {
            const last = new Date(n.last_active_at).getTime()
            return Number.isFinite(last) && (Date.now() - last > 24 * 60 * 60 * 1000)
        })

        if (staleNodes.length > 0) {
            issues.push(`${staleNodes.length} 個節點超過24小時未活動`)
        }

        // 3. 修復 MCP 節點狀態
        const { data: staleMcp, error: mcpErr } = await supabase
            .from('mcp_nodes')
            .select('id')
            .eq('status', 'online')
            .lt('last_heartbeat', new Date(Date.now() - 30 * 60 * 1000).toISOString())

        if (mcpErr) throw mcpErr

        if (staleMcp && staleMcp.length > 0) {
            const ids = staleMcp.map((m: any) => m.id)
            await supabase
                .from('mcp_nodes')
                .update({ status: 'offline' })
                .in('id', ids)
            fixed.push(`${staleMcp.length} 個 MCP 節點標記為 offline`)
        }

        // 4. 檢查 API 健康
        const { data: apiErrors, error: apiErr } = await supabase
            .from('api_health_logs')
            .select('endpoint')
            .eq('is_healthy', false)
            .gte('checked_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())

        if (apiErr) throw apiErr

        if (apiErrors && apiErrors.length > 0) {
            issues.push(`過去1小時 ${apiErrors.length} 個 API 錯誤`)
        }

        // 5. 記錄本次巡邏
        await supabase.from('api_health_logs').insert({
            endpoint: '/system-healer',
            method: req.method,
            status_code: 200,
            response_time_ms: Date.now() - start,
            is_healthy: true,
            checked_at: new Date().toISOString()
        })

        return new Response(JSON.stringify({
            success: true,
            issues,
            fixed,
            nodes_active: nodes?.length || 0,
            stale_nodes: staleNodes.length,
            latency_ms: Date.now() - start,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        // record failure
        try {
            await supabase.from('api_health_logs').insert({
                endpoint: '/system-healer',
                method: req.method,
                status_code: 500,
                response_time_ms: Date.now() - start,
                is_healthy: false,
                error_message: err?.message ?? String(err),
                checked_at: new Date().toISOString()
            })
        } catch {
            // ignore logging errors
        }

        return new Response(JSON.stringify({
            success: false,
            error: err?.message ?? String(err),
            latency_ms: Date.now() - start
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})