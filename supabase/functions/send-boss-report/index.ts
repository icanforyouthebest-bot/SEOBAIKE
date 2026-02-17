import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Telegram Bot config
const TG_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const TG_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID') || ''

// Line Messaging API config (Line Notify 已於 2025/3 停用)
const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID') || ''
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ============================================================
    // 1. 統計昨日 KPI
    // ============================================================
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const ydStr = yesterday.toISOString().split('T')[0]
    const todayStr = new Date().toISOString().split('T')[0]

    const { data: logs } = await supabase
      .from('ai_customer_logs')
      .select('id, status, user_id, created_at')
      .gte('created_at', ydStr)
      .lt('created_at', todayStr)

    const total = logs?.length || 0
    const success = logs?.filter((r: any) => r.status === 'success').length || 0
    const errors = logs?.filter((r: any) => r.status === 'error').length || 0
    const blocked = logs?.filter((r: any) => r.status === 'blocked').length || 0
    const uniqueUsers = new Set(logs?.map((r: any) => r.user_id).filter(Boolean)).size

    // ============================================================
    // 2. 系統健康
    // ============================================================
    const { data: health } = await supabase
      .from('system_health')
      .select('component, status, last_heartbeat')

    const healthyCount = health?.filter((h: any) => h.status === 'healthy').length || 0
    const totalComponents = health?.length || 0
    const systemStatus = healthyCount === totalComponents ? '正常' : '異常'

    // ============================================================
    // 3. API Keys 狀態 (快速檢查)
    // ============================================================
    const arsenalRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/ceo-dashboard?action=arsenal`,
      {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
      }
    )
    const arsenal = arsenalRes.ok ? await arsenalRes.json() : { summary: 'N/A', health_pct: 0 }

    // ============================================================
    // 4. 組裝報告
    // ============================================================
    const reportLines = [
      `📅 [集團日報] ${todayStr}`,
      `━━━━━━━━━━━━━━━━━`,
      `${systemStatus === '正常' ? '🟢' : '🔴'} 系統狀態：${systemStatus} (${arsenal.summary || 'N/A'})`,
      `💰 昨日單量：${total} 單`,
      `👥 不重複客戶：${uniqueUsers} 人`,
      `✅ 成功：${success} | ❌ 錯誤：${errors} | 🚫 攔截：${blocked}`,
      `📉 故障率：${total > 0 ? ((errors / total) * 100).toFixed(1) : '0'}%`,
      `🔑 API 軍火庫：${arsenal.health_pct || 0}% 健康`,
      `⚠️ 異常警報：${errors > 0 ? `${errors} 筆 API 錯誤` : '無'}`,
      `━━━━━━━━━━━━━━━━━`,
      `⏰ 報告時間：${new Date().toISOString()}`,
      ``,
      `— SEOBAIKE CEO Dashboard`,
      `— 指揮官：許竣翔`,
      `— Patent 115100981`,
    ]
    const reportText = reportLines.join('\n')

    // ============================================================
    // 5. 發送通知
    // ============================================================
    const results: Record<string, string> = {}

    // Telegram
    if (TG_BOT_TOKEN && TG_CHAT_ID) {
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: TG_CHAT_ID,
              text: reportText,
              parse_mode: 'HTML',
            }),
          }
        )
        results.telegram = tgRes.ok ? 'SENT' : `FAILED_${tgRes.status}`
      } catch (e) {
        results.telegram = `ERROR: ${e.message}`
      }
    } else {
      results.telegram = 'NOT_CONFIGURED'
    }

    // Line Messaging API (push message to boss)
    if (LINE_CHANNEL_ID && LINE_CHANNEL_SECRET) {
      try {
        // Get channel access token
        const tokenRes = await fetch('https://api.line.me/v2/oauth/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=client_credentials&client_id=${LINE_CHANNEL_ID}&client_secret=${LINE_CHANNEL_SECRET}`,
        })
        if (tokenRes.ok) {
          const { access_token } = await tokenRes.json()
          // Push to all followers via broadcast
          const pushRes = await fetch('https://api.line.me/v2/bot/message/broadcast', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [{ type: 'text', text: reportText }],
            }),
          })
          results.line = pushRes.ok ? 'SENT' : `FAILED_${pushRes.status}`
        } else {
          results.line = `TOKEN_FAILED_${tokenRes.status}`
        }
      } catch (e) {
        results.line = `ERROR: ${e.message}`
      }
    } else {
      results.line = 'NOT_CONFIGURED'
    }

    // ============================================================
    // 6. 寫入紀錄
    // ============================================================
    await supabase.from('configs').insert({
      service: 'send-boss-report',
      key: `daily_report_${todayStr}`,
      value: 'SENT',
      metadata: {
        kpi: { total, success, errors, blocked, uniqueUsers },
        delivery: results,
        generated_at: new Date().toISOString(),
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        report: reportText,
        delivery: results,
        kpi: { total, success, errors, blocked, uniqueUsers },
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('send-boss-report error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
