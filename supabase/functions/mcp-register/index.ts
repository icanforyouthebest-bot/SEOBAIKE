// ═══════════════════════════════════════════════════════════════
// mcp-register — MCP 工具/服務市集登記 API
// SEOBAIKE = AI 界的 App Store | 台灣專利 115100981
// 小路光有限公司 | 許竣翔
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
    const action = url.searchParams.get('action') || 'list'
    const body = req.method === 'POST' ? await req.json() : {}

    // ── 1. 登記新 MCP 服務 ────────────────────────────────────
    if (action === 'register') {
      const {
        name, description, endpoint_url, category,
        provider_id, pricing_model, price_per_call,
        capabilities, l1_node_id, l2_node_id,
      } = body

      if (!name || !endpoint_url || !provider_id) {
        return new Response(JSON.stringify({
          error: 'name、endpoint_url、provider_id 為必填',
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data, error } = await supabase
        .from('mcp_services')
        .insert({
          name,
          description,
          endpoint_url,
          category: category || 'general',
          provider_id,
          pricing_model: pricing_model || 'per_call',
          price_per_call: price_per_call || 0,
          capabilities: capabilities || [],
          l1_node_id: l1_node_id || null,
          l2_node_id: l2_node_id || null,
          status: 'pending_review',
          registered_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      console.log(`[mcp-register] 新 MCP 服務登記：${name}`)
      return new Response(JSON.stringify({
        success: true,
        service: data,
        message: '服務已提交審核，通過後即上架市集',
        platform: 'SEOBAIKE',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 2. 列出所有 MCP 服務 ─────────────────────────────────
    if (action === 'list') {
      const category = url.searchParams.get('category') || body.category
      const status = url.searchParams.get('status') || 'active'
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
      const offset = (page - 1) * limit

      let query = supabase
        .from('mcp_services')
        .select('*', { count: 'exact' })
        .eq('status', status)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false })

      if (category) query = query.eq('category', category)

      const { data, error, count } = await query
      if (error) throw error

      return new Response(JSON.stringify({
        services: data,
        total: count,
        page,
        limit,
        pages: Math.ceil((count || 0) / limit),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 3. 查詢單一服務詳情 ──────────────────────────────────
    if (action === 'detail') {
      const id = url.searchParams.get('id') || body.id
      const { data, error } = await supabase
        .from('mcp_services')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error

      // 也拉訂閱統計
      const { count: subCount } = await supabase
        .from('mcp_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('service_id', id)
        .eq('status', 'active')

      return new Response(JSON.stringify({
        service: data,
        active_subscribers: subCount || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 4. 訂閱 MCP 服務 ─────────────────────────────────────
    if (action === 'subscribe') {
      const { service_id, user_id, plan } = body
      if (!service_id || !user_id) {
        return new Response(JSON.stringify({ error: 'service_id 和 user_id 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 檢查是否已訂閱
      const { data: existing } = await supabase
        .from('mcp_subscriptions')
        .select('id, status')
        .eq('service_id', service_id)
        .eq('user_id', user_id)
        .single()

      if (existing?.status === 'active') {
        return new Response(JSON.stringify({ message: '已訂閱此服務', subscription_id: existing.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('mcp_subscriptions')
        .upsert({
          service_id,
          user_id,
          plan: plan || 'basic',
          status: 'active',
          subscribed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        subscription: data,
        message: '訂閱成功，可立即使用此 MCP 服務',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 5. 審核 MCP 服務（老闆/管理員）─────────────────────
    if (action === 'approve') {
      const { service_id, approved, reason } = body

      const { data, error } = await supabase
        .from('mcp_services')
        .update({
          status: approved ? 'active' : 'rejected',
          review_note: reason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', service_id)
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        service: data,
        message: approved ? 'MCP 服務已上架市集' : 'MCP 服務已拒絕',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      error: '未知 action',
      valid_actions: ['register', 'list', 'detail', 'subscribe', 'approve'],
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[mcp-register] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
