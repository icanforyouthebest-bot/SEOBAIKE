/**
 * AI Empire — Workers → Azure 路由
 * Cloudflare Workers 把重運算任務轉發到 Azure Functions
 */

export interface AzureRouterEnv {
  AZURE_OPENAI_ENDPOINT?: string
  AZURE_OPENAI_API_KEY?: string
  AZURE_OPENAI_DEPLOYMENT?: string
  AZURE_SPEECH_KEY?: string
  AZURE_SPEECH_REGION?: string
  BING_SEARCH_API_KEY?: string
}

// ── Azure OpenAI (GPT-4o) ──────────────────────────
export async function callAzureOpenAI(
  env: AzureRouterEnv,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 500
): Promise<string | null> {
  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) return null
  const deployment = env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o'
  const url = `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deployment}/chat/completions?api-version=2024-12-01-preview`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': env.AZURE_OPENAI_API_KEY },
      body: JSON.stringify({ messages, max_tokens: maxTokens, temperature: 0.7 }),
    })
    if (!res.ok) return null
    const data = await res.json() as any
    return data.choices?.[0]?.message?.content || null
  } catch { return null }
}

// ── Azure Speech TTS (繁體中文配音) ─────────────────
export async function azureSpeechTTS(
  env: AzureRouterEnv,
  text: string,
  voice = 'zh-TW-HsiaoChenNeural'
): Promise<ArrayBuffer | null> {
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) return null
  const url = `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`
  const ssml = `<speak version='1.0' xml:lang='zh-TW'>
    <voice name='${voice}'>${text}</voice>
  </speak>`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    })
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch { return null }
}

// ── Bing Search API (SEO 排名查詢) ──────────────────
export async function bingSearch(
  env: AzureRouterEnv,
  query: string,
  count = 10
): Promise<any[] | null> {
  if (!env.BING_SEARCH_API_KEY) return null
  const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=${count}&mkt=zh-TW`
  try {
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': env.BING_SEARCH_API_KEY }
    })
    if (!res.ok) return null
    const data = await res.json() as any
    return data.webPages?.value || null
  } catch { return null }
}

// ── Azure AI Router — 主入口 ────────────────────────
// 小白問重問題時自動升級到 Azure OpenAI
export async function azureAIChat(
  env: AzureRouterEnv,
  systemPrompt: string,
  userMessage: string
): Promise<{ reply: string; engine: string } | null> {
  // 先試 Azure OpenAI (GPT-4o)
  const azureReply = await callAzureOpenAI(env, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ])
  if (azureReply) return { reply: azureReply, engine: 'azure-openai-gpt4o' }
  return null
}
