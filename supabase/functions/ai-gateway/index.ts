import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-node-id, x-api-key',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const nodeId = req.headers.get('x-node-id')

  if (!nodeId) {
    return new Response(JSON.stringify({ error: 'missing_node_id' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 強制驗證節點
  const { data: access } = await supabase.rpc('verify_node_access', { p_node_id: nodeId })

  if (!access?.allowed) {
    return new Response(JSON.stringify({ error: access?.reason || 'access_denied' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 注入知識庫
  const { data: knowledge } = await supabase
    .from('knowledge_base')
    .select('title, content, category')
    .limit(10)

  // 記錄請求
  await supabase.from('mcp_nodes')
    .update({ last_heartbeat: new Date().toISOString(), total_requests: supabase.rpc('total_requests + 1') })
    .eq('node_network_id', nodeId)

  return new Response(JSON.stringify({
    allowed: true,
    node: access,
    knowledge_context: knowledge,
    timestamp: new Date().toISOString()
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
