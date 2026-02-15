import { describe, it, expect, vi } from 'vitest'

// Mock fetch for auth tests
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { lookupAuth } from './auth'

describe('認證模組 lookupAuth', () => {
  const URL = 'https://test.supabase.co'
  const KEY = 'test-key'

  it('已綁定用戶回傳正確權限', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => [{
        id: 'binding-1',
        user_id: 'user-123',
        permission_level: 'boss',
      }],
    })

    const result = await lookupAuth(URL, KEY, 'telegram', 'tg_user_1')
    expect(result.is_bound).toBe(true)
    expect(result.permission_level).toBe('boss')
    expect(result.user_id).toBe('user-123')
  })

  it('未綁定用戶回傳預設 user 權限', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => [],
    })

    const result = await lookupAuth(URL, KEY, 'line', 'unknown_user')
    expect(result.is_bound).toBe(false)
    expect(result.permission_level).toBe('user')
    expect(result.user_id).toBeNull()
  })

  it('API 回傳 null 不爆炸', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => null,
    })

    const result = await lookupAuth(URL, KEY, 'whatsapp', 'wa_user')
    expect(result.is_bound).toBe(false)
    expect(result.permission_level).toBe('user')
  })

  it('正確組合 API 請求', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => [],
    })

    await lookupAuth(URL, KEY, 'messenger', 'msg_user')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('remote_command_bindings'),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: KEY,
        }),
      })
    )
  })
})
