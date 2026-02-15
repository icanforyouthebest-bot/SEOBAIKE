import { describe, it, expect, vi } from 'vitest'
import { checkRateLimit } from './rate-limiter'

describe('限流模組 checkRateLimit', () => {
  it('無 KV 時允許所有請求', async () => {
    const result = await checkRateLimit(undefined, 'test', 60)
    expect(result.allowed).toBe(true)
  })

  it('cooldown 為 0 時允許所有請求', async () => {
    const mockKV = { get: vi.fn(), put: vi.fn() } as any
    const result = await checkRateLimit(mockKV, 'test', 0)
    expect(result.allowed).toBe(true)
  })

  it('首次請求允許通過', async () => {
    const mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    } as any

    const result = await checkRateLimit(mockKV, 'user:123', 60)
    expect(result.allowed).toBe(true)
    expect(mockKV.put).toHaveBeenCalled()
  })

  it('冷卻期內拒絕請求', async () => {
    const now = Date.now()
    const mockKV = {
      get: vi.fn().mockResolvedValue(String(now - 10000)), // 10 秒前
      put: vi.fn(),
    } as any

    const result = await checkRateLimit(mockKV, 'user:123', 60) // 冷卻 60 秒
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('冷卻期過後允許請求', async () => {
    const now = Date.now()
    const mockKV = {
      get: vi.fn().mockResolvedValue(String(now - 120000)), // 120 秒前
      put: vi.fn().mockResolvedValue(undefined),
    } as any

    const result = await checkRateLimit(mockKV, 'user:123', 60) // 冷卻 60 秒
    expect(result.allowed).toBe(true)
  })
})
