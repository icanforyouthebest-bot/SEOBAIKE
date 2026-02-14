import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, queue_id, approval_code, platform, platform_user_id, reason,
            command, sub_command, args, request_metadata } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let data, error

    switch (action) {
      case 'approve':
        ({ data, error } = await supabaseClient.rpc('approve_command', {
          p_queue_id: queue_id || null,
          p_approval_code: approval_code || null,
          p_approver_platform: platform,
          p_approver_platform_user_id: platform_user_id,
          p_reason: reason || null,
        }))
        break

      case 'reject':
        ({ data, error } = await supabaseClient.rpc('reject_command', {
          p_queue_id: queue_id || null,
          p_approval_code: approval_code || null,
          p_approver_platform: platform,
          p_approver_platform_user_id: platform_user_id,
          p_reason: reason || '老闆拒絕',
        }))
        break

      case 'pending':
        ({ data, error } = await supabaseClient.rpc('list_pending_approvals', {
          p_approver_platform: platform || null,
          p_approver_platform_user_id: platform_user_id || null,
        }))
        break

      case 'queue':
        ({ data, error } = await supabaseClient.rpc('queue_approval', {
          p_command: command,
          p_sub_command: sub_command || null,
          p_args: args || {},
          p_request_metadata: request_metadata || {},
          p_requester_platform: platform || 'web',
          p_requester_platform_user_id: platform_user_id || null,
        }))
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    if (error) {
      console.error('Boss Approval RPC Error:', error)
      throw error
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
