// ============================================================
// BAIKE 負載測試 — 1,000 併發 TPS
// 用法: npx tsx scripts/load-test.ts
// 環境變數: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vmyrivxxibqydccurxug.supabase.co'
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const WORKER_URL = process.env.WORKER_URL || 'https://seobaike-remote-control.icanforyouthebest.workers.dev'

interface TestResult {
  test: string
  total: number
  success: number
  failed: number
  avg_ms: number
  p50_ms: number
  p95_ms: number
  p99_ms: number
  max_ms: number
  tps: number
}

async function timedFetch(url: string, opts: RequestInit): Promise<{ ok: boolean; ms: number; status: number }> {
  const start = performance.now()
  try {
    const res = await fetch(url, opts)
    return { ok: res.ok, ms: performance.now() - start, status: res.status }
  } catch {
    return { ok: false, ms: performance.now() - start, status: 0 }
  }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(sorted.length * p / 100) - 1
  return sorted[Math.max(0, idx)]
}

function summarize(test: string, results: { ok: boolean; ms: number }[]): TestResult {
  const times = results.map(r => r.ms).sort((a, b) => a - b)
  const success = results.filter(r => r.ok).length
  const totalTime = times.reduce((a, b) => a + b, 0)
  return {
    test,
    total: results.length,
    success,
    failed: results.length - success,
    avg_ms: Math.round(totalTime / results.length),
    p50_ms: Math.round(percentile(times, 50)),
    p95_ms: Math.round(percentile(times, 95)),
    p99_ms: Math.round(percentile(times, 99)),
    max_ms: Math.round(times[times.length - 1]),
    tps: Math.round(results.length / (totalTime / 1000 / results.length)),
  }
}

// 批次併發（每批 batch 個，共 total 個）
async function runBatch(
  test: string,
  total: number,
  batch: number,
  fn: () => Promise<{ ok: boolean; ms: number }>
): Promise<TestResult> {
  const results: { ok: boolean; ms: number }[] = []
  for (let i = 0; i < total; i += batch) {
    const size = Math.min(batch, total - i)
    const batchResults = await Promise.all(Array.from({ length: size }, fn))
    results.push(...batchResults)
    process.stdout.write(`\r  ${test}: ${results.length}/${total}`)
  }
  console.log()
  return summarize(test, results)
}

// ============================================================
// 測試項目
// ============================================================

// T1: Worker Health Check
async function testWorkerHealth() {
  return runBatch('Worker Health', 1000, 100, () =>
    timedFetch(WORKER_URL, { method: 'GET' })
  )
}

// T2: Edge Function — list pending approvals
async function testEdgePending() {
  return runBatch('Edge Pending', 500, 50, () =>
    timedFetch(`${SUPABASE_URL}/functions/v1/boss-approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SRK}` },
      body: JSON.stringify({ action: 'pending', platform: 'test', platform_user_id: 'load-test' }),
    })
  )
}

// T3: REST API — read ai_model_registry
async function testRestRead() {
  return runBatch('REST Read', 1000, 100, () =>
    timedFetch(`${SUPABASE_URL}/rest/v1/ai_model_registry?select=model_id,provider,tier&limit=5`, {
      headers: { 'apikey': SRK, 'Authorization': `Bearer ${SRK}` },
    })
  )
}

// T4: RPC — list_pending_approvals direct
async function testRpcDirect() {
  return runBatch('RPC Direct', 500, 50, () =>
    timedFetch(`${SUPABASE_URL}/rest/v1/rpc/list_pending_approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SRK, 'Authorization': `Bearer ${SRK}` },
      body: JSON.stringify({ p_approver_platform: null, p_approver_platform_user_id: null }),
    })
  )
}

// T5: RPC — expire_stale_approvals (寫入)
async function testRpcWrite() {
  return runBatch('RPC Write', 200, 20, () =>
    timedFetch(`${SUPABASE_URL}/rest/v1/rpc/expire_stale_approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SRK, 'Authorization': `Bearer ${SRK}` },
      body: '{}',
    })
  )
}

// T6: Full chain — Worker → Edge → RPC (via gateway)
async function testFullChain() {
  return runBatch('Full Chain', 200, 20, () =>
    timedFetch(`${WORKER_URL}/api/gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '/status', userId: null, sub_command: null, args: {} }),
    })
  )
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('============================================================')
  console.log('BAIKE 負載測試 — 開始')
  console.log(`Worker:   ${WORKER_URL}`)
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`SRK:      ${SRK ? '已設定' : '⚠️ 未設定'}`)
  console.log('============================================================\n')

  const results: TestResult[] = []

  results.push(await testWorkerHealth())
  results.push(await testEdgePending())
  results.push(await testRestRead())
  results.push(await testRpcDirect())
  results.push(await testRpcWrite())
  results.push(await testFullChain())

  console.log('\n============================================================')
  console.log('                    負載測試結果報告')
  console.log('============================================================')
  console.log(
    'Test'.padEnd(16) +
    'Total'.padStart(7) +
    'OK'.padStart(7) +
    'Fail'.padStart(7) +
    'Avg'.padStart(8) +
    'P50'.padStart(8) +
    'P95'.padStart(8) +
    'P99'.padStart(8) +
    'Max'.padStart(8) +
    'TPS'.padStart(8)
  )
  console.log('-'.repeat(85))

  for (const r of results) {
    const status = r.failed === 0 ? '✅' : '❌'
    console.log(
      `${status} ${r.test}`.padEnd(16) +
      String(r.total).padStart(7) +
      String(r.success).padStart(7) +
      String(r.failed).padStart(7) +
      `${r.avg_ms}ms`.padStart(8) +
      `${r.p50_ms}ms`.padStart(8) +
      `${r.p95_ms}ms`.padStart(8) +
      `${r.p99_ms}ms`.padStart(8) +
      `${r.max_ms}ms`.padStart(8) +
      String(r.tps).padStart(8)
    )
  }

  const allOk = results.every(r => r.failed === 0)
  const avgP95 = Math.round(results.reduce((a, r) => a + r.p95_ms, 0) / results.length)

  console.log('\n============================================================')
  console.log(`總體結果: ${allOk ? '✅ ALL PASS' : '❌ HAS FAILURES'}`)
  console.log(`平均 P95: ${avgP95}ms`)
  console.log(`建議: ${avgP95 < 500 ? '性能良好，可上線' : avgP95 < 1000 ? '性能可接受' : '需要優化'}`)
  console.log('============================================================')
}

main().catch(console.error)
