// ============================================================
// 頻率限制 — Cloudflare KV 實作
// ============================================================

export async function checkRateLimit(
  kv: KVNamespace | undefined,
  key: string,
  cooldownSeconds: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (!kv || cooldownSeconds <= 0) return { allowed: true }

  const cacheKey = `rate:${key}`
  const lastCall = await kv.get(cacheKey)

  if (lastCall) {
    const elapsed = (Date.now() - parseInt(lastCall)) / 1000
    if (elapsed < cooldownSeconds) {
      return { allowed: false, retryAfter: Math.ceil(cooldownSeconds - elapsed) }
    }
  }

  await kv.put(cacheKey, String(Date.now()), { expirationTtl: cooldownSeconds })
  return { allowed: true }
}
