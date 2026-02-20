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
      const sort = url.searchParams.get('sort') || 'created_at'
      const order = (url.searchParams.get('order') || 'desc') === 'asc'
      const offset = (page - 1) * limit

      let query = supabase
        .from('marketplace_products')
        .select('*, marketplace_reviews(count)', { count: 'exact' })
        .eq('status', 'active')
        .range(offset, offset + limit - 1)
        .order(sort, { ascending: order })

      if (category) query = query.eq('category', category)
      if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)

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
        supabase.from('marketplace_reviews').select('*').eq('product_id', id).order('created_at', { ascending: false }).limit(10),
      ])

      if (pErr) throw pErr

      // 瀏覽數 +1
      await supabase.rpc('increment_product_view', { product_id: id }).catch(() => null)

      return new Response(JSON.stringify({
        product,
        reviews,
        review_count: reviews?.length || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 3. 購買商品 ─────────────────────────────────────────
    if (action === 'purchase') {
      const { product_id, user_id, quantity = 1, payment_method } = body

      if (!product_id || !user_id) {
        return new Response(JSON.stringify({ error: 'product_id 和 user_id 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 查商品價格
      const { data: product, error: pErr } = await supabase
        .from('marketplace_products')
        .select('id, name, price_cents, currency, merchant_id, stock')
        .eq('id', product_id)
        .single()

      if (pErr || !product) throw new Error('商品不存在')
      if (product.stock !== null && product.stock < quantity) throw new Error('庫存不足')

      const total_cents = product.price_cents * quantity

      // 建立訂單
      const { data: order, error: oErr } = await supabase
        .from('marketplace_orders')
        .insert({
          product_id,
          buyer_id: user_id,
          merchant_id: product.merchant_id,
          quantity,
          unit_price_cents: product.price_cents,
          total_cents,
          currency: product.currency || 'TWD',
          payment_method: payment_method || 'points',
          status: 'pending',
        })
        .select()
        .single()

      if (oErr) throw oErr

      console.log(`[marketplace-api] 新訂單：${order.id}，金額：${total_cents}`)

      return new Response(JSON.stringify({
        success: true,
        order,
        total_cents,
        message: '訂單建立成功，請完成付款',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 4. 刊登商品 ─────────────────────────────────────────
    if (action === 'list-product') {
      const {
        merchant_id, name, description, category,
        price_cents, currency = 'TWD', stock, images, tags,
      } = body

      if (!merchant_id || !name || !price_cents) {
        return new Response(JSON.stringify({ error: 'merchant_id、name、price_cents 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('marketplace_products')
        .insert({
          merchant_id, name, description,
          category: category || 'other',
          price_cents, currency, stock: stock ?? null,
          images: images || [], tags: tags || [],
          status: 'pending_review',
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

    // ── 5. 寫評論 ────────────────────────────────────────────
    if (action === 'review') {
      const { product_id, user_id, rating, comment } = body

      if (!product_id || !user_id || !rating) {
        return new Response(JSON.stringify({ error: 'product_id、user_id、rating 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (rating < 1 || rating > 5) throw new Error('評分必須在 1-5 之間')

      const { data, error } = await supabase
        .from('marketplace_reviews')
        .upsert({
          product_id, user_id,
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

    // ── 6. 我的訂單 ─────────────────────────────────────────
    if (action === 'my-orders') {
      const user_id = url.searchParams.get('user_id') || body.user_id
      const status = url.searchParams.get('status')

      let query = supabase
        .from('marketplace_orders')
        .select('*, marketplace_products(name, images)')
        .eq('buyer_id', user_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (status) query = query.eq('status', status)

      const { data, error } = await query
      if (error) throw error

      return new Response(JSON.stringify({ orders: data, total: data?.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      error: '未知 action',
      valid_actions: ['products', 'product', 'purchase', 'list-product', 'review', 'my-orders'],
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[marketplace-api] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
