import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================================
// ElevenLabs Voice Service — 第 16 把武器
// 文字轉語音 (TTS)，支援中文、英文、日文
// ============================================================

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1'

// 預設語音 ID（可擴充）
const VOICES: Record<string, string> = {
  'rachel': '21m00Tcm4TlvDq8ikWAM',     // Rachel - 美式女聲
  'adam': 'pNInz6obpgDQGcFmaJgB',        // Adam - 美式男聲
  'bella': 'EXAVITQu4vr4xnSDxMaL',      // Bella - 美式女聲
  'default': '21m00Tcm4TlvDq8ikWAM',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!apiKey) {
      return jsonResponse(200, {
        success: false,
        error: 'ELEVENLABS_API_KEY not configured',
        note: 'Set via: npx supabase secrets set ELEVENLABS_API_KEY=xxx',
      })
    }

    const body = await req.json()
    const action = body.action || 'tts'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ============================================================
    // TTS: 文字轉語音
    // ============================================================
    if (action === 'tts') {
      const { text, voice, model_id } = body

      if (!text) {
        return jsonResponse(400, { error: 'text is required' })
      }

      const voiceId = VOICES[voice || 'default'] || VOICES['default']
      const selectedModel = model_id || 'eleven_multilingual_v2'

      const ttsRes = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.substring(0, 5000),
          model_id: selectedModel,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      })

      if (!ttsRes.ok) {
        const errText = await ttsRes.text().catch(() => 'unknown')
        return jsonResponse(ttsRes.status, {
          error: 'ElevenLabs TTS failed',
          detail: errText.substring(0, 300),
        })
      }

      // 回傳音訊 binary
      const audioBuffer = await ttsRes.arrayBuffer()

      return new Response(audioBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'inline; filename="speech.mp3"',
        },
      })
    }

    // ============================================================
    // voices: 列出可用語音
    // ============================================================
    if (action === 'voices') {
      const voicesRes = await fetch(`${ELEVENLABS_API}/voices`, {
        headers: { 'xi-api-key': apiKey },
      })

      if (!voicesRes.ok) {
        return jsonResponse(500, { error: 'Failed to fetch voices' })
      }

      const data = await voicesRes.json()
      const voices = data.voices?.map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels,
      })) || []

      return jsonResponse(200, { voices, count: voices.length })
    }

    // ============================================================
    // status: 檢查 API 狀態和額度
    // ============================================================
    if (action === 'status') {
      const subRes = await fetch(`${ELEVENLABS_API}/user/subscription`, {
        headers: { 'xi-api-key': apiKey },
      })

      if (!subRes.ok) {
        return jsonResponse(200, { status: 'error', connected: false })
      }

      const sub = await subRes.json()
      return jsonResponse(200, {
        status: 'active',
        connected: true,
        tier: sub.tier,
        character_count: sub.character_count,
        character_limit: sub.character_limit,
        remaining: sub.character_limit - sub.character_count,
      })
    }

    return jsonResponse(404, { error: 'Unknown action. Available: tts, voices, status' })

  } catch (error) {
    console.error('[elevenlabs-voice] error:', error)
    return jsonResponse(500, {
      error: 'Voice service failed',
      message: (error as Error).message,
    })
  }
})

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
