// ═══════════════════════════════════════════════════════════════
// commission-api — 佣金計算與支付 API
// 台灣金融合規 AML/KYC | 台灣專利 115100981
// 小路光有限公司 | 許竣翔
// ═══════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── 佣金計算核心 ────────────────────────────────────────────
function calculateCommission(
  grossCents: number,
  rule: { type: string; percentage_bp?: number; fixed_cents?: number; min_cents?: number; max_cents?: number }
): number {
  let commission = 0

  if (rule.type === 'percentage' && rule.percentage_bp) {
    commission = Math.round(grossCents * rule.percentage_bp / 10000)
  } else if (rule.type === 'fixed' && rule.fixed_cents) {
    commission = rule.fixed_cents
  } else if (rule.type === 'tiered' && rule.percentage_bp) {
    // 階梯式：基礎百分比計算
    commission = Math.round(grossCents * rule.percentage_bp / 10000)
  }

  // 套用上下限
  if (rule.max_cents) commission = Math.min(commission, rule.max_cents)
  if (rule.min_cents) commission = Math.max(commission, rule.min_cents)

  return commission
}

// ─── 反踢佣偵測 ──────────────────────────────────────────────
async function detectAntiKickback(
  supabase: any,
  merchantId: string,
  currentAmount: number
): Promise<{ suspicious: boolean; score: number; reason?: string }> {
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('total_cents')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!recentOrders || recentOrders.length < 3) {
    return { suspicious: false, score: 0 }
  }

  const avgAmount = recentOrders.reduce((s: number, o: any) => s + o.total_cents, 0) / recentOrders.length

  if (currentAmount > avgAmount * 5) {
    const score = Math.min(100, Math.round((currentAmount / avgAmount) * 10))
    return {
      suspicious: true,
      score,
      reason: `交易金額 (${currentAmount}) 超過近期平均 (${Math.round(avgAmount)}) 的 5 倍`,
    }
  }

  return { suspicious: false, score: 0 }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'calculate'
    const body = req.method === 'POST' ? await req.json() : {}

    // ── 1. 計算佣金（不寫入）────────────────────────────────
    if (action === 'calculate') {
      const { merchant_id, gross_cents } = body

      if (!merchant_id || !gross_cents) {
        return new Response(JSON.stringify({ error: 'merchant_id 和 gross_cents 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 抓取佣金規則
      const { data: rules, error: rErr } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('merchant_id', merchant_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (rErr) throw rErr

      const rule = rules?.[0] || { type: 'percentage', percentage_bp: 250 } // 預設 2.5%
      const commission_cents = calculateCommission(gross_cents, rule)
      const net_cents = gross_cents - commission_cents

      return new Response(JSON.stringify({
        gross_cents,
        commission_cents,
        net_cents,
        commission_rate: `${((commission_cents / gross_cents) * 100).toFixed(2)}%`,
        rule_used: rule,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 2. 執行佣金結算（寫入）──────────────────────────────
    if (action === 'settle') {
      const { merchant_id, order_id, gross_cents } = body

      if (!merchant_id || !order_id || !gross_cents) {
        return new Response(JSON.stringify({ error: 'merchant_id、order_id、gross_cents 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 1. 抓規則
      const { data: rules } = await supabase
        .from('commission_rules')
        .select('*')
        .eq('merchant_id', merchant_id)
        .eq('is_active', true)
        .limit(1)

      const rule = rules?.[0] || { type: 'percentage', percentage_bp: 250 }
      const commission_cents = calculateCommission(gross_cents, rule)
      const net_cents = gross_cents - commission_cents

      // 2. 反踢佣偵測
      const kickback = await detectAntiKickback(supabase, merchant_id, gross_cents)

      // 3. 寫入結算記錄
      const { data: payout, error: pErr } = await supabase
        .from('commission_payouts')
        .insert({
          merchant_id,
          order_id,
          rule_id: rule.id || null,
          gross_cents,
          commission_cents,
          net_cents,
          status: kickback.suspicious && kickback.score >= 70 ? 'blocked' : 'pending',
          reason_blocked: kickback.suspicious && kickback.score >= 70 ? kickback.reason : null,
        })
        .select()
        .single()

      if (pErr) throw pErr

      // 4. 如果可疑，寫入反踢佣記錄
      if (kickback.suspicious) {
        await supabase.from('anti_kickback_patterns').insert({
          merchant_id,
          pattern_type: 'high_value_order',
          description: kickback.reason,
          score: kickback.score,
          metadata: { order_id, gross_cents },
        })

        // 廣播警告給 CEO
        await supabase.channel('ceo-realtime').send({
          type: 'broadcast',
          event: 'kickback_alert',
          payload: { merchant_id, order_id, score: kickback.score, reason: kickback.reason },
        }).catch(() => null)
      }

      console.log(`[commission-api] 結算完成：order=${order_id}, commission=${commission_cents}, net=${net_cents}`)

      return new Response(JSON.stringify({
        success: true,
        payout,
        kickback_check: kickback,
        blocked: payout.status === 'blocked',
        message: payout.status === 'blocked' ? '⚠️ 佣金已凍結，疑似反踢佣行為' : '✅ 佣金結算完成',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 3. 查詢佣金記錄 ──────────────────────────────────────
    if (action === 'payouts') {
      const merchant_id = url.searchParams.get('merchant_id') || body.merchant_id
      const status = url.searchParams.get('status')
      const page = parseInt(url.searchParams.get('page') || '1')
      const limit = 20
      const offset = (page - 1) * limit

      let query = supabase
        .from('commission_payouts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (merchant_id) query = query.eq('merchant_id', merchant_id)
      if (status) query = query.eq('status', status)

      const { data, error, count } = await query
      if (error) throw error

      // 統計
      const totalGross = data?.reduce((s: number, p: any) => s + p.gross_cents, 0) || 0
      const totalCommission = data?.reduce((s: number, p: any) => s + p.commission_cents, 0) || 0

      return new Response(JSON.stringify({
        payouts: data,
        total: count,
        page,
        summary: {
          total_gross_cents: totalGross,
          total_commission_cents: totalCommission,
          total_net_cents: totalGross - totalCommission,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 4. 設定佣金規則 ──────────────────────────────────────
    if (action === 'set-rule') {
      const { merchant_id, type, percentage_bp, fixed_cents, min_cents, max_cents, name } = body

      if (!merchant_id || !type) {
        return new Response(JSON.stringify({ error: 'merchant_id 和 type 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 停用舊規則
      await supabase
        .from('commission_rules')
        .update({ is_active: false })
        .eq('merchant_id', merchant_id)
        .eq('is_active', true)

      // 建立新規則
      const { data, error } = await supabase
        .from('commission_rules')
        .insert({
          merchant_id,
          name: name || `${type} rule`,
          type,
          percentage_bp: percentage_bp || null,
          fixed_cents: fixed_cents || null,
          min_cents: min_cents || null,
          max_cents: max_cents || null,
          is_active: true,
          rate_basis: 'order_total',
        })
        .select()
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, rule: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── 5. 退款追回佣金 ──────────────────────────────────────
    if (action === 'clawback') {
      const { payout_id, reason, amount_cents } = body

      if (!payout_id) {
        return new Response(JSON.stringify({ error: 'payout_id 為必填' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data, error } = await supabase
        .from('commission_clawbacks')
        .insert({
          payout_id,
          reason: reason || 'refund_processed',
          amount_cents: amount_cents || null,
          status: 'initiated',
        })
        .select()
        .single()

      if (error) throw error

      // 更新原始支付狀態
      await supabase
        .from('commission_payouts')
        .update({ status: 'clawed_back' })
        .eq('id', payout_id)

      return new Response(JSON.stringify({ success: true, clawback: data, message: '佣金追回程序已啟動' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── 6. 佣金報表 ──────────────────────────────────────────
    if (action === 'report') {
      const merchant_id = url.searchParams.get('merchant_id')
      const from = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString()
      const to = url.searchParams.get('to') || new Date().toISOString()

      let query = supabase
        .from('commission_payouts')
        .select('gross_cents, commission_cents, net_cents, status, created_at')
        .gte('created_at', from)
        .lte('created_at', to)

      if (merchant_id) query = query.eq('merchant_id', merchant_id)

      const { data, error } = await query
      if (error) throw error

      const byStatus = (data || []).reduce((acc: any, row: any) => {
        acc[row.status] = (acc[row.status] || 0) + 1
        return acc
      }, {})

      const totalGross = (data || []).reduce((s: number, r: any) => s + r.gross_cents, 0)
      const totalCommission = (data || []).reduce((s: number, r: any) => s + r.commission_cents, 0)

      return new Response(JSON.stringify({
        period: { from, to },
        total_transactions: data?.length,
        by_status: byStatus,
        totals: {
          gross_cents: totalGross,
          commission_cents: totalCommission,
          net_cents: totalGross - totalCommission,
          commission_rate: totalGross > 0 ? `${((totalCommission / totalGross) * 100).toFixed(2)}%` : '0%',
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      error: '未知 action',
      valid_actions: ['calculate', 'settle', 'payouts', 'set-rule', 'clawback', 'report'],
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error('[commission-api] Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
