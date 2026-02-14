import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // 1. 處理 CORS (允許跨域請求)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. 接收來自 Worker (遙控器) 的指令
    const { command, userId, metadata } = await req.json()

    // 3. 初始化 Supabase Client (使用 Service Role 最高權限)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. 呼叫 SQL RPC (execute_remote_command)
    // 這裡我們把責任全丟給 SQL Function，只負責傳遞參數
    const { data, error } = await supabaseClient.rpc('execute_remote_command', {
      command_type: command,
      request_metadata: { ...metadata, user_id: userId }
    })

    if (error) {
      console.error('SQL Execution Error:', error)
      throw error
    }

    // 5. 回傳結果 (保持純淨 JSON，不加任何廢話)
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
