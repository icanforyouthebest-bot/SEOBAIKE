// ═══════════════════════════════════════════════════════════════
// marketplace-api — SEOBAIKE 市集 API
// AI 界的 App Store | 台灣專利 115100981
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
    const action = url.searchParams.get('action') || 'products'
    const body = req.method === 'POST' ? await req.json() : {}

    // ── 1. 商品列表 ─────────────────────────────────────────
    if (action === 'products') {
      const category = url.searchParams.get('category')
      const search = url.searchParams.get('q')
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
      const offset = (page - 1) * limit

      let query = supabase
        .from('marketplace_products')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false })

      if (category) query = query.eq('category', category)
      if (search) query = query.or(`product_name.ilike.%${search}%,description.ilike.%${search}%`)

      const { data, error, count } = await query
      if (error) throw error

      return new Response(JSON.stringify({
        products: data,
        total: count,
        page,
        pages: Math.ceil((count || 0) / limit),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 2. 商品詳情 ─────────────────────────────────────────
    if (action === 'product') {
      const id = url.searchParams.get('id') || body.id

      const [{ data: product, error: pErr }, { data: reviews }] = await Promise.all([
        supabase.from('marketplace_products').select('*').eq('id', id).single(),
        supabase.from('marketplace_reviews').select('*').eq('listing_id', id).order('created_at', { ascending: false }).limit(10),
      ])

      if (pErr) throw pErr

      return new Response(JSON.stringify({
        product,
        reviews,
        review_count: reviews?.length || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 3. 刊登商品 ─────────────────────────────────────────
    if (action === 'list-product') {
      const {
        seller_node_id, product_name, description, category,
        price_points, stock, commission_to_upline,
        requires_patent_verify, requires_script_verify,
      } = body

      if (!seller_node_id || !product_name || !price_points) {
        return new Response(JSON.stringify({ error: 'seller_node_id、product_name、price_points 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('marketplace_products')
        .insert({
          seller_node_id,
          product_name,
          description,
          category: category || 'other',
          price_points,
          stock: stock ?? null,
          commission_to_upline: commission_to_upline || 0,
          requires_patent_verify: requires_patent_verify || false,
          requires_script_verify: requires_script_verify || false,
          is_active: false,
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        product: data,
        message: '商品已提交審核，通過後上架市集',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 4. 寫評論 ────────────────────────────────────────────
    if (action === 'review') {
      const { listing_id, reviewer_id, reviewer_name, rating, comment } = body

      if (!listing_id || !reviewer_id || !rating) {
        return new Response(JSON.stringify({ error: 'listing_id、reviewer_id、rating 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (rating < 1 || rating > 5) throw new Error('評分必須在 1-5 之間')

      const { data, error } = await supabase
        .from('marketplace_reviews')
        .upsert({
          listing_id,
          reviewer_id,
          reviewer_name: reviewer_name || 'Anonymous',
          rating: Math.round(rating),
          comment: comment || '',
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, review: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      error: '未知 action',
      valid_actions: ['products', 'product', 'list-product', 'review'],
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[marketplace-api] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
