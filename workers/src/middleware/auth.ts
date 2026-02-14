// ============================================================
// 權限查詢 — 從 remote_command_bindings 取得用戶身份
// ============================================================

interface AuthResult {
  user_id: string | null
  permission_level: string
  binding_id: string | null
  is_bound: boolean
}

export async function lookupAuth(
  supabaseUrl: string,
  serviceKey: string,
  platform: string,
  platformUserId: string
): Promise<AuthResult> {
  const res = await fetch(`${supabaseUrl}/rest/v1/remote_command_bindings?platform=eq.${platform}&platform_user_id=eq.${encodeURIComponent(platformUserId)}&is_verified=eq.true&select=id,user_id,permission_level&limit=1`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  })

  const data = await res.json() as any[]

  if (data && data.length > 0) {
    return {
      user_id: data[0].user_id,
      permission_level: data[0].permission_level,
      binding_id: data[0].id,
      is_bound: true,
    }
  }

  return {
    user_id: null,
    permission_level: 'user',
    binding_id: null,
    is_bound: false,
  }
}
