import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const checks: { name: string; status: 'pass' | 'warn' | 'fail'; detail: string; value?: number }[] = []
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 3600_000).toISOString()
  const oneDayAgo = new Date(now.getTime() - 86400_000).toISOString()
  // 1. Database connectivity
  try {
    const start = Date.now()
    const { error } = await supabase.from('configs').select('id').limit(1)
    const ms = Date.now() - start
    checks.push({
      name: 'db_connectivity',
      status: ms < 2000 ? 'pass' : ms < 5000 ? 'warn' : 'fail',
      detail: `${ms}ms response time`,
      value: ms,
    })
  } catch (e) {
    checks.push({ name: 'db_connectivity', status: 'fail', detail: (e as Error).message })
  }

  // 2. AI Gateway activity (last hour)
  try {
    const { count } = await supabase
      .from('ai_customer_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo)
    checks.push({
      name: 'ai_gateway_activity',
      status: (count || 0) > 0 ? 'pass' : 'warn',
      detail: `${count || 0} requests in last hour`,
      value: count || 0,
    })
  } catch (e) {
    checks.push({ name: 'ai_gateway_activity', status: 'warn', detail: (e as Error).message })
  }
  // 3. Error rate (last 24h)
  try {
    const { count: total } = await supabase
      .from('ai_customer_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)
    const { count: errors } = await supabase
      .from('ai_customer_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)
      .eq('status', 'error')
    const rate = (total || 0) > 0 ? ((errors || 0) / (total || 1)) * 100 : 0
    checks.push({
      name: 'error_rate_24h',
      status: rate < 5 ? 'pass' : rate < 15 ? 'warn' : 'fail',
      detail: `${rate.toFixed(1)}% (${errors}/${total})`,
      value: rate,
    })
  } catch (e) {
    checks.push({ name: 'error_rate_24h', status: 'warn', detail: (e as Error).message })
  }
  // 4. Inference violations (last 24h)
  try {
    const { count } = await supabase
      .from('inference_violations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)
    checks.push({
      name: 'inference_violations_24h',
      status: (count || 0) === 0 ? 'pass' : (count || 0) < 10 ? 'warn' : 'fail',
      detail: `${count || 0} violations in 24h`,
      value: count || 0,
    })
  } catch (e) {
    checks.push({ name: 'inference_violations_24h', status: 'warn', detail: (e as Error).message })
  }

  // 5. Rate limit effectiveness
  try {
    const { count } = await supabase
      .from('ai_customer_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)
      .eq('status', 'blocked')
    checks.push({
      name: 'rate_limiter',
      status: 'pass',
      detail: `${count || 0} blocked requests in 24h`,
      value: count || 0,
    })
  } catch (e) {
    checks.push({ name: 'rate_limiter', status: 'warn', detail: (e as Error).message })
  }
  // 6. World Definition integrity
  try {
    const { count: nodes } = await supabase
      .from('world_definition')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    const { count: allowed } = await supabase
      .from('allowed_inference_paths')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    const { count: forbidden } = await supabase
      .from('forbidden_inference_paths')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    checks.push({
      name: 'world_definition',
      status: (nodes || 0) >= 80 ? 'pass' : 'fail',
      detail: `${nodes} nodes, ${allowed} allowed paths, ${forbidden} forbidden paths`,
      value: nodes || 0,
    })
  } catch (e) {
    checks.push({ name: 'world_definition', status: 'fail', detail: (e as Error).message })
  }
  // 7. Provider health (error rate per provider in 24h)
  try {
    const { data: logs } = await supabase
      .from('ai_customer_logs')
      .select('status, response')
      .gte('created_at', oneDayAgo)
      .limit(1000)

    const providerStats: Record<string, { ok: number; fail: number }> = {}
    for (const log of (logs || [])) {
      const provider = log.response?.provider
      if (!provider) continue // Skip blocked/filtered requests (no provider)
      if (!providerStats[provider]) providerStats[provider] = { ok: 0, fail: 0 }
      if (log.status === 'success') providerStats[provider].ok++
      else providerStats[provider].fail++
    }

    const unhealthy = Object.entries(providerStats)
      .filter(([, s]) => s.fail / (s.ok + s.fail) > 0.2)
      .map(([name]) => name)

    checks.push({
      name: 'provider_health',
      status: unhealthy.length === 0 ? 'pass' : unhealthy.length < 3 ? 'warn' : 'fail',
      detail: unhealthy.length ? `Unhealthy: ${unhealthy.join(', ')}` : `All providers healthy (${Object.keys(providerStats).length} active)`,
      value: unhealthy.length,
    })
  } catch (e) {
    checks.push({ name: 'provider_health', status: 'warn', detail: (e as Error).message })
  }
  // Aggregate
  const failCount = checks.filter(c => c.status === 'fail').length
  const warnCount = checks.filter(c => c.status === 'warn').length
  const overall = failCount > 0 ? 'CRITICAL' : warnCount > 0 ? 'WARNING' : 'HEALTHY'

  // Record to system_health_checks
  try {
    await supabase.from('system_health_checks').insert({
      check_type: 'automated_health_monitor',
      status: overall === 'HEALTHY' ? 'healthy' : overall === 'WARNING' ? 'degraded' : 'unhealthy',
      details: { checks, overall, fail_count: failCount, warn_count: warnCount },
      checked_at: now.toISOString(),
    })
  } catch (e) {
    console.error('Failed to record health check:', e)
  }
  // Broadcast alert if not healthy
  if (overall !== 'HEALTHY') {
    try {
      const channel = supabase.channel('ceo-realtime')
      await channel.send({
        type: 'broadcast',
        event: 'health_alert',
        payload: {
          overall,
          fail_count: failCount,
          warn_count: warnCount,
          failed_checks: checks.filter(c => c.status !== 'pass').map(c => c.name),
          timestamp: now.toISOString(),
        },
      })
    } catch (e) {
      console.error('Failed to broadcast alert:', e)
    }
  }
  return new Response(JSON.stringify({
    overall,
    timestamp: now.toISOString(),
    checks,
    summary: {
      total: checks.length,
      pass: checks.filter(c => c.status === 'pass').length,
      warn: warnCount,
      fail: failCount,
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
