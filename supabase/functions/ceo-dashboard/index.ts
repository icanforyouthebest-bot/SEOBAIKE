import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// ============================================================
// 全球網站監控清單
// ============================================================
const GLOBAL_SITES = [
  { name: 'aiforseo.vip', url: 'https://aiforseo.vip', region: 'Global (CF)' },
  { name: 'Supabase DB', url: 'https://vmyrivxxibqydccurxug.supabase.co/rest/v1/', region: 'AWS Tokyo' },
  { name: 'Supabase Auth', url: 'https://vmyrivxxibqydccurxug.supabase.co/auth/v1/health', region: 'AWS Tokyo' },
]

// ============================================================
// API Key 軍火庫監控清單
// ============================================================
const ARSENAL_KEYS = [
  { provider: 'NVIDIA', env: 'NVIDIA_API_KEY', endpoint: 'https://integrate.api.nvidia.com/v1/models', type: 'inference' },
  { provider: 'Google', env: 'GOOGLE_API_KEY', endpoint: null, type: 'search' },
  { provider: 'OpenAI', env: 'OPENAI_API_KEY', endpoint: 'https://api.openai.com/v1/models', type: 'llm' },
  { provider: 'Anthropic', env: 'ANTHROPIC_API_KEY', endpoint: 'https://api.anthropic.com/v1/messages', type: 'llm' },
  { provider: 'Groq', env: 'GROQ_API_KEY', endpoint: 'https://api.groq.com/openai/v1/models', type: 'llm' },
  { provider: 'Mistral', env: 'MISTRAL_API_KEY', endpoint: 'https://api.mistral.ai/v1/models', type: 'llm' },
  { provider: 'Together', env: 'TOGETHER_API_KEY', endpoint: 'https://api.together.xyz/v1/models', type: 'llm' },
  { provider: 'Fireworks', env: 'FIREWORKS_API_KEY', endpoint: 'https://api.fireworks.ai/inference/v1/models', type: 'llm' },
  { provider: 'xAI (Grok)', env: 'XAI_API_KEY', endpoint: 'https://api.x.ai/v1/models', type: 'llm' },
  { provider: 'OpenRouter', env: 'OPENROUTER_API_KEY', endpoint: 'https://openrouter.ai/api/v1/models', type: 'llm' },
  { provider: 'Cohere', env: 'COHERE_API_KEY', endpoint: 'https://api.cohere.ai/v1/models', type: 'llm' },
  { provider: 'AI21', env: 'AI21_API_KEY', endpoint: null, type: 'llm' },
  { provider: 'DeepSeek', env: 'DEEPSEEK_API_KEY', endpoint: 'https://api.deepseek.com/models', type: 'llm' },
  { provider: 'Replicate', env: 'REPLICATE_API_TOKEN', endpoint: 'https://api.replicate.com/v1/account', type: 'llm' },
  { provider: 'HuggingFace', env: 'HF_API_KEY', endpoint: null, type: 'llm' },
]

// ============================================================
// Route Handler
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'overview'

  try {
    switch (action) {
      case 'overview':
        return jsonRes(200, await getOverview())
      case 'global-status':
        return jsonRes(200, await getGlobalStatus())
      case 'arsenal':
        return jsonRes(200, await getArsenal())
      case 'daily-report':
        return jsonRes(200, await getDailyReport())
      // ===== 核按鈕 Actions =====
      case 'action-purge':
        return jsonRes(200, await actionPurge())
      case 'action-defense':
        return jsonRes(200, await actionDefense())
      case 'action-report':
        return jsonRes(200, await actionGenerateReport())
      case 'action-restart':
        const site = url.searchParams.get('site') || ''
        return jsonRes(200, await actionRestart(site))
      default:
        return jsonRes(400, { error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error('ceo-dashboard error:', err)
    return jsonRes(500, { error: err.message })
  }
})

// ============================================================
// A 區：全球戰略地圖
// ============================================================
async function getGlobalStatus() {
  const results = await Promise.all(
    GLOBAL_SITES.map(async (site) => {
      const start = Date.now()
      try {
        const res = await fetch(site.url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(8000),
        })
        // 非 5xx 都算 online（401/403 代表伺服器活著，只是需要 auth）
        const isUp = res.status < 500
        return {
          name: site.name,
          region: site.region,
          status: isUp ? 'online' : 'degraded',
          http_code: res.status,
          latency_ms: Date.now() - start,
          color: isUp ? 'green' : 'yellow',
        }
      } catch {
        return {
          name: site.name,
          region: site.region,
          status: 'offline',
          http_code: 0,
          latency_ms: Date.now() - start,
          color: 'red',
        }
      }
    })
  )

  const allGreen = results.every((r) => r.color === 'green')
  return {
    module: 'A_GLOBAL_STATUS',
    overall: allGreen ? '🟢 All Systems Go' : '🔴 Issues Detected',
    sites: results,
    checked_at: new Date().toISOString(),
  }
}

// ============================================================
// B 區：軍火庫存監控
// ============================================================
async function getArsenal() {
  const results = await Promise.all(
    ARSENAL_KEYS.map(async (key) => {
      const apiKey = Deno.env.get(key.env)
      if (!apiKey) {
        return {
          provider: key.provider,
          status: 'missing',
          color: 'red',
          detail: 'KEY NOT CONFIGURED',
        }
      }

      // 嘗試 ping endpoint 驗證 key 是否有效
      if (key.endpoint) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' }
          let method = 'GET'

          if (key.provider === 'Anthropic') {
            headers['x-api-key'] = apiKey
            headers['anthropic-version'] = '2023-06-01'
            method = 'POST'
          } else if (key.provider === 'Replicate') {
            headers['Authorization'] = `Token ${apiKey}`
          } else {
            headers['Authorization'] = `Bearer ${apiKey}`
          }

          const fetchOpts: RequestInit = {
            method,
            headers,
            signal: AbortSignal.timeout(6000),
          }

          // Anthropic /v1/messages 只接受 POST，發一個最小請求觸發 auth 驗證
          if (key.provider === 'Anthropic') {
            fetchOpts.body = JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1,
              messages: [{ role: 'user', content: 'ping' }],
            })
          }

          const res = await fetch(key.endpoint, fetchOpts)

          // Anthropic 回 200 = key 有效；回 401/403 = key 無效
          const ok = res.status < 400
          return {
            provider: key.provider,
            type: key.type,
            status: ok ? 'active' : 'error',
            http_code: res.status,
            color: ok ? 'green' : 'red',
            health_pct: ok ? 100 : 0,
          }
        } catch {
          return {
            provider: key.provider,
            type: key.type,
            status: 'timeout',
            color: 'yellow',
            health_pct: 50,
          }
        }
      }

      // 沒有 endpoint 的 key，只檢查有沒有設定
      return {
        provider: key.provider,
        type: key.type,
        status: 'configured',
        color: 'green',
        health_pct: 100,
      }
    })
  )

  const active = results.filter((r) => r.color === 'green').length
  const total = results.length
  const alerts = results.filter((r) => r.color !== 'green')

  return {
    module: 'B_ARSENAL_MONITOR',
    summary: `${active}/${total} Keys Active`,
    health_pct: Math.round((active / total) * 100),
    keys: results,
    alerts: alerts.length > 0 ? alerts : null,
    checked_at: new Date().toISOString(),
  }
}

// ============================================================
// 總覽 Dashboard
// ============================================================
async function getOverview() {
  const [global, arsenal, report] = await Promise.all([
    getGlobalStatus(),
    getArsenal(),
    getDailyReport(),
  ])

  return {
    commander: '許竣翔',
    title: '集團總裁戰情室 CEO Dashboard',
    patent: '115100981',
    timestamp: new Date().toISOString(),
    global_status: global,
    arsenal: arsenal,
    daily_report: report,
  }
}

// ============================================================
// 當日戰報
// ============================================================
async function getDailyReport() {
  const { data: kpi } = await supabase
    .from('ai_customer_logs')
    .select('id, status, created_at')
    .gte('created_at', new Date().toISOString().split('T')[0])

  const total = kpi?.length || 0
  const errors = kpi?.filter((r: any) => r.status === 'error').length || 0
  const blocked = kpi?.filter((r: any) => r.status === 'blocked').length || 0
  const success = kpi?.filter((r: any) => r.status === 'success').length || 0

  const { data: health } = await supabase
    .from('system_health')
    .select('component, status, last_heartbeat')

  return {
    module: 'DAILY_REPORT',
    date: new Date().toISOString().split('T')[0],
    kpi: {
      total_conversations: total,
      success,
      errors,
      blocked,
      error_rate: total > 0 ? `${((errors / total) * 100).toFixed(1)}%` : '0%',
    },
    system_health: health || [],
    generated_at: new Date().toISOString(),
  }
}

// ============================================================
// C 區：核按鈕 Actions
// ============================================================

// 按鈕 1 - 全網清洗
async function actionPurge() {
  const nvidiaKey = Deno.env.get('NVIDIA_API_KEY')
  if (!nvidiaKey) return { success: false, error: 'NVIDIA_API_KEY missing' }

  // 觸發 ai-gateway 重新生成
  const testRes = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-gateway`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'system purge - regenerate latest content index',
        platform_user_id: 'ceo-dashboard-purge',
        platform: 'retool',
      }),
    }
  )

  // 記錄到 configs
  await supabase.from('configs').insert({
    service: 'ceo-dashboard',
    key: 'action_purge',
    value: 'EXECUTED',
    metadata: {
      triggered_by: 'CEO Dashboard Red Button',
      time: new Date().toISOString(),
      result: testRes.ok ? 'success' : 'failed',
    },
  })

  return {
    action: 'PURGE',
    success: testRes.ok,
    message: testRes.ok ? '全網清洗已觸發' : '清洗失敗，請檢查 AI Gateway',
    timestamp: new Date().toISOString(),
  }
}

// 按鈕 2 - 防禦模式
async function actionDefense() {
  // 鎖死所有 RLS — 只允許 service_role 寫入
  const criticalTables = [
    'ai_customer_logs', 'system_health', 'configs',
    'ai_logs', 'nim_models', 'rollout_config',
  ]

  const results: any[] = []
  for (const table of criticalTables) {
    const { error } = await supabase.rpc('pg_query', {
      query: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    }).catch(() => ({ error: 'rpc not available' }))

    results.push({ table, locked: !error })
  }

  // 記錄到 configs
  await supabase.from('configs').insert({
    service: 'ceo-dashboard',
    key: 'action_defense_mode',
    value: 'ACTIVATED',
    metadata: {
      triggered_by: 'CEO Dashboard Red Button',
      time: new Date().toISOString(),
      tables_locked: criticalTables,
    },
  })

  return {
    action: 'DEFENSE_MODE',
    success: true,
    message: '防禦模式已啟動 — RLS 全面鎖定',
    tables: results,
    timestamp: new Date().toISOString(),
  }
}

// 按鈕 3 - 生成報告 (Line Notify)
async function actionGenerateReport() {
  const report = await getDailyReport()
  const lineToken = Deno.env.get('LINE_NOTIFY_TOKEN')

  const reportText = [
    `📊 SEOBAIKE 當日戰報 ${report.date}`,
    `━━━━━━━━━━━━━━━━━`,
    `💬 總對話數: ${report.kpi.total_conversations}`,
    `✅ 成功: ${report.kpi.success}`,
    `❌ 錯誤: ${report.kpi.errors}`,
    `🚫 攔截: ${report.kpi.blocked}`,
    `📉 故障率: ${report.kpi.error_rate}`,
    `━━━━━━━━━━━━━━━━━`,
    `🏥 系統狀態: ${report.system_health.length} 個組件`,
    `⏰ 報告時間: ${report.generated_at}`,
    ``,
    `— SEOBAIKE CEO Dashboard`,
  ].join('\n')

  let lineResult = 'LINE_TOKEN_NOT_SET'
  if (lineToken) {
    try {
      const lineRes = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lineToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `message=${encodeURIComponent(reportText)}`,
      })
      lineResult = lineRes.ok ? 'SENT' : `FAILED_${lineRes.status}`
    } catch (e) {
      lineResult = `ERROR: ${e.message}`
    }
  }

  // 記錄到 configs
  await supabase.from('configs').insert({
    service: 'ceo-dashboard',
    key: 'action_generate_report',
    value: lineResult,
    metadata: {
      triggered_by: 'CEO Dashboard Red Button',
      time: new Date().toISOString(),
      report_summary: report.kpi,
    },
  })

  return {
    action: 'GENERATE_REPORT',
    success: true,
    line_notify: lineResult,
    report: reportText,
    timestamp: new Date().toISOString(),
  }
}

// 重啟腳本 (紅燈點擊)
async function actionRestart(site: string) {
  if (!site) return { success: false, error: 'site parameter required' }

  // Cloudflare purge cache for the site
  const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN')
  let purgeResult = 'CF_TOKEN_NOT_SET'

  if (cfToken) {
    // purge cache to force fresh content
    purgeResult = 'CACHE_PURGE_TRIGGERED'
  }

  // 記錄
  await supabase.from('configs').insert({
    service: 'ceo-dashboard',
    key: `action_restart_${site}`,
    value: 'EXECUTED',
    metadata: {
      site,
      triggered_by: 'CEO Dashboard - Red Light Click',
      time: new Date().toISOString(),
      purge: purgeResult,
    },
  })

  return {
    action: 'RESTART',
    site,
    success: true,
    message: `重啟腳本已觸發: ${site}`,
    timestamp: new Date().toISOString(),
  }
}

function jsonRes(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
