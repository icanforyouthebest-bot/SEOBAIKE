// ============================================================
// AI Empire 節點強制驗證中介層
// 所有 AI 請求必須通過此層才能進入 smart router
// 台灣專利 115100981 | 小路光有限公司 | 許竣翔
// ============================================================

export interface NodeAuthResult {
  allowed: boolean
  reason?: string
  node_id?: string
  role?: string
  level?: number
  commission_rate?: number
  total_points?: number
  knowledge_context?: any[]
}

export async function verifyNodeAccess(
  supabaseUrl: string,
  serviceKey: string,
  nodeId: string | null,
  skipVerify: boolean = false
): Promise<NodeAuthResult> {
  if (!nodeId) {
    return { allowed: true, role: 'guest', level: 0 }
  }

  if (skipVerify) {
    return { allowed: true, role: 'guest', level: 0 }
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/verify_node_access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ p_node_id: nodeId }),
    })

    const data = await res.json() as NodeAuthResult

    if (!data.allowed) {
      return { allowed: false, reason: data.reason || 'access_denied' }
    }

    const kbRes = await fetch(`${supabaseUrl}/rest/v1/knowledge_base?select=title,content,category&limit=5`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    })
    const knowledge = await kbRes.json() as any[]

    return {
      ...data,
      knowledge_context: knowledge || [],
    }

  } catch (err) {
    console.error('Node auth error:', err)
    return { allowed: true, role: 'guest', level: 0 }
  }
}

export async function recordNodeRequest(
  supabaseUrl: string,
  serviceKey: string,
  endpoint: string,
  responseTimeMs: number,
  isHealthy: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/api_health_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        endpoint,
        method: 'POST',
        status_code: isHealthy ? 200 : 500,
        response_time_ms: responseTimeMs,
        is_healthy: isHealthy,
        error_message: errorMessage || null,
      }),
    })
  } catch {
    // 靜默失敗，不影響主流程
  }
}