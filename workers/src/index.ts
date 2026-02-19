// ============================================================
// SEOBAIKE 遙控器 — AI Remote Control
// 多平台 AI 中控 + Inline Keyboard
// ============================================================

import type { Env, NormalizedMessage, ReplyContext } from './types'
import { callAzureOpenAI, azureSpeechTTS, bingSearch } from './ai/azure-router'
import { normalizeLine, normalizeTelegram, normalizeWhatsApp, normalizeMessenger } from './middleware/normalizer'
import { normalizeDiscord } from './middleware/normalizer-discord'
import { normalizeSlack } from './middleware/normalizer-slack'
import { normalizeTeams } from './middleware/normalizer-teams'
import { normalizeEmail } from './middleware/normalizer-email'
import { normalizeGoogleChat } from './middleware/normalizer-google-chat'
import { normalizeWechat } from './middleware/normalizer-wechat'
import { normalizeSignal } from './middleware/normalizer-signal'
import { normalizeViber } from './middleware/normalizer-viber'
import { normalizeSms } from './middleware/normalizer-sms'
import { normalizeWebWidget } from './middleware/normalizer-web-widget'
import { verifyLine, verifyTelegram, verifyWhatsApp, verifyMessenger, verifyDiscord, verifySlack } from './middleware/signature-verify'
import { parseCommand } from './middleware/command-parser'
import { replyLine, pushLine } from './reply/line-reply'
import { replyTelegram, answerCallback, type TelegramReplyOptions } from './reply/telegram-reply'
import { replyWhatsApp } from './reply/whatsapp-reply'
import { replyMessenger } from './reply/messenger-reply'
import { replyDiscordInteraction, replyDiscordChannel } from './reply/discord-reply'
import { replySlack, pushSlackDM } from './reply/slack-reply'
import { replyTeams } from './reply/teams-reply'
import { replyEmail } from './reply/email-reply'
import { replyGoogleChat } from './reply/google-chat-reply'
import { replyWechat } from './reply/wechat-reply'
import { replySignal } from './reply/signal-reply'
import { replyViber } from './reply/viber-reply'
import { replySms } from './reply/sms-reply'
import { replyWebWidget } from './reply/web-widget-reply'
import { aiFormat, aiChat, aiConstrainedChat } from './ai/brain'
import { lookupAuth } from './middleware/auth'
import { checkRateLimit } from './middleware/rate-limiter'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // ── 真實頁面路由 → 從 GitHub 取 pages-site/*.html ──
    const SITE_PAGES: Record<string, string> = {
      '/': 'index.html',
      '/about': 'about.html',
      '/features': 'features.html',
      '/pricing': 'pricing.html',
      '/docs': 'docs.html',
      '/contact': 'contact.html',
      '/blog': 'blog.html',
      '/login': 'login.html',
      '/dashboard': 'dashboard.html',
      '/ecosystem': 'ecosystem.html',
      '/marketing': 'marketing.html',
      '/privacy': 'privacy.html',
      '/terms': 'terms.html',
      '/marketplace': 'marketplace.html',
      '/bots': 'bots.html',
      '/ai': 'ai.html',
      '/status': 'status.html',
      '/start': 'start.html',
      '/compliance': 'compliance.html',
      '/billing': 'billing.html',
      '/commander': 'commander.html',
      '/ceo': 'ceo.html',
    }
    const cleanPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
    const pageFile = SITE_PAGES[cleanPath]
    if (pageFile) {
      // ── 戰情室 commander / CEO 不快取，永遠取最新版 ──
      const isCommander = cleanPath === '/commander' || cleanPath === '/ceo'
      if (!isCommander) {
        const cache = caches.default
        const cacheKey = new Request(url.toString(), request)
        const purge = url.searchParams.get('purge')
        if (!purge) {
          const cached = await cache.match(cacheKey)
          if (cached) return cached
        }
      }
      const rawRes = await fetch(`https://raw.githubusercontent.com/icanforyouthebest-bot/SEOBAIKE/refs/heads/master/pages-site/${pageFile}`)
      const body = await rawRes.text()
      // ── 國家偵測：注入 data-cf-country 屬性供 i18n 自動切換語言 ──
      const country = (request as any).cf?.country || 'US'
      let injectedBody = body.replace('<html ', `<html data-cf-country="${country}" `)
      // CEO 頁面：注入 service key
      if (cleanPath === '/ceo') {
        injectedBody = injectedBody.replace('%%SUPABASE_KEY%%', env.SUPABASE_SERVICE_ROLE_KEY || '')
      }
      if (isCommander) {
        // 戰情室：永不快取，老闆永遠看到最新
        return new Response(injectedBody, {
          status: rawRes.status,
          headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache', 'X-Cache': 'BYPASS' },
        })
      }
      const resp = new Response(injectedBody, {
        status: rawRes.status,
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600', 'X-Cache': 'MISS' },
      })
      if (rawRes.ok) { const cache = caches.default; const cacheKey = new Request(url.toString(), request); const toCache = new Response(injectedBody, { status: 200, headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600', 'X-Cache': 'HIT' } }); cache.put(cacheKey, toCache) }
      return resp
    }

    // ── SEO：robots.txt + sitemap.xml ──
    if (path === '/robots.txt') {
      return new Response(`User-agent: *\nAllow: /\nSitemap: https://aiforseo.vip/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400' } })
    }
    if (path === '/sitemap.xml') {
      const pages = ['', '/about', '/features', '/pricing', '/docs', '/contact', '/blog', '/login', '/dashboard', '/ecosystem', '/marketing', '/privacy', '/terms', '/marketplace', '/bots', '/ai', '/status', '/start', '/compliance', '/billing']
      const urls = pages.map(p => `  <url><loc>https://aiforseo.vip${p}</loc><lastmod>2026-02-16</lastmod><changefreq>weekly</changefreq><priority>${p === '' ? '1.0' : '0.8'}</priority></url>`).join('\n')
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=86400' } })
    }

    // ── 靜態資源 → 代理到 GitHub pages-site/ + 邊緣快取 ──
    if (path.startsWith('/assets/') || path === '/favicon.svg' || path === '/favicon.ico' || path === '/og-image.png' || path === '/manifest.json' || path === '/seobaike-config.js' || path === '/seobaike-widget.js') {
      const cache = caches.default
      const cacheKey = new Request(url.toString(), request)
      const cached = await cache.match(cacheKey)
      if (cached) return cached
      const assetFile = path.startsWith('/') ? path.slice(1) : path
      const rawRes = await fetch(`https://raw.githubusercontent.com/icanforyouthebest-bot/SEOBAIKE/master/pages-site/${assetFile}`)
      const contentType = path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.png') ? 'image/png' : path.endsWith('.ico') ? 'image/x-icon' : 'application/octet-stream'
      const resp = new Response(rawRes.body, {
        status: rawRes.status,
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
      })
      if (rawRes.ok) cache.put(cacheKey, resp.clone())
      return resp
    }

    // ── Google Search Console 驗證 ──
    if (path === '/google1d30b7964cf86d2c.html') {
      return new Response('google-site-verification: google1d30b7964cf86d2c.html', {
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=86400' },
      })
    }

    // ── Apple / Google 驗證檔案（App Store + Play Store 上架必備） ──
    if (path === '/.well-known/apple-developer-domain-association.txt') {
      return new Response('// Apple Developer Domain Association\n// Domain: aiforseo.vip\n// Organization: 小路光有限公司 (Xiao Lu Guang Limited Company)\n// Tax ID: 60475510\n\n', {
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=3600' },
      })
    }
    if (path === '/apple-app-site-association' || path === '/.well-known/apple-app-site-association') {
      return new Response(JSON.stringify({
        applinks: { details: [{ appIDs: [], components: [{ '/': '/*' }] }] },
        webcredentials: { apps: [] },
      }), {
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      })
    }
    if (path === '/.well-known/assetlinks.json') {
      return new Response(JSON.stringify([{
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: 'vip.aiforseo.app', sha256_cert_fingerprints: [] },
      }]), {
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      })
    }

    // ── /widget.js — 小白嵌入碼，客戶貼一行就能安裝 ──
    if (path === '/widget.js') {
      const widgetId = url.searchParams.get('id') || 'demo'
      const primaryColor = url.searchParams.get('color') || '#6366f1'
      const widgetJs = `(function(){
  if(window.__seobaikeWidget)return;
  window.__seobaikeWidget=true;
  var id='${widgetId}';
  var color='${primaryColor}';
  var d=document,s=d.createElement('style');
  s.textContent='#sb-widget-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:'+color+';border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.25);z-index:9999;display:flex;align-items:center;justify-content:center;transition:transform .2s}#sb-widget-btn:hover{transform:scale(1.1)}#sb-widget-box{position:fixed;bottom:96px;right:24px;width:360px;height:500px;border-radius:16px;background:#fff;box-shadow:0 8px 40px rgba(0,0,0,.18);z-index:9998;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif}#sb-widget-box.open{display:flex}#sb-header{background:'+color+';color:#fff;padding:16px;font-weight:700;font-size:15px;display:flex;align-items:center;gap:10px}#sb-header span{flex:1}#sb-close{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0}#sb-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}#sb-input-row{display:flex;padding:12px;gap:8px;border-top:1px solid #f0f0f0}.sb-msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5}.sb-bot{background:#f4f4f5;align-self:flex-start;border-radius:4px 12px 12px 12px}.sb-user{background:'+color+';color:#fff;align-self:flex-end;border-radius:12px 4px 12px 12px}#sb-input{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;font-size:14px;outline:none}#sb-send{background:'+color+';color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-size:14px}';
  d.head.appendChild(s);
  var btn=d.createElement('button');btn.id='sb-widget-btn';
  btn.innerHTML='<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  var box=d.createElement('div');box.id='sb-widget-box';
  box.innerHTML='<div id="sb-header"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="8" r="4"/><path d="M12 14c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z"/></svg><span>小白 AI 客服</span><button id="sb-close">×</button></div><div id="sb-messages"><div class="sb-msg sb-bot">嗨！我是小白，有什麼可以幫您的嗎？</div></div><div id="sb-input-row"><input id="sb-input" placeholder="輸入訊息..." /><button id="sb-send">送出</button></div>';
  d.body.appendChild(btn);d.body.appendChild(box);
  btn.onclick=function(){box.classList.toggle('open')};
  d.getElementById('sb-close').onclick=function(){box.classList.remove('open')};
  var msgs=d.getElementById('sb-messages');
  var inp=d.getElementById('sb-input');
  function send(){
    var msg=inp.value.trim();if(!msg)return;
    inp.value='';
    var um=d.createElement('div');um.className='sb-msg sb-user';um.textContent=msg;msgs.appendChild(um);
    msgs.scrollTop=msgs.scrollHeight;
    var thinking=d.createElement('div');thinking.className='sb-msg sb-bot';thinking.textContent='...';msgs.appendChild(thinking);
    fetch('https://aiforseo.vip/api/ai/widget-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,widget_id:id})})
    .then(function(r){return r.json()})
    .then(function(data){thinking.textContent=data.reply||'稍等一下！'})
    .catch(function(){thinking.textContent='連線異常，請稍後再試'});
    msgs.scrollTop=msgs.scrollHeight;
  }
  d.getElementById('sb-send').onclick=send;
  inp.onkeydown=function(e){if(e.key==='Enter')send()};
})();`
      return new Response(widgetJs, {
        headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // ── 其他非 /api/ 路徑 → SPA fallback，回傳 index.html 讓 React Router 處理 ──
    // /merchant、/merchant/editor、/dashboard/seo 等所有 SPA 路由都從這裡服務
    if (!path.startsWith('/api/') && path !== '/api') {
      const cache = caches.default
      const spaCacheKey = new Request('https://aiforseo.vip/__spa_index__', request)
      const spaCached = await cache.match(spaCacheKey)
      if (spaCached) return spaCached
      const rawRes = await fetch(`https://raw.githubusercontent.com/icanforyouthebest-bot/SEOBAIKE/refs/heads/master/pages-site/index.html`)
      const body = await rawRes.text()
      const country = (request as any).cf?.country || 'US'
      const injectedBody = body.replace('<html ', `<html data-cf-country="${country}" `)
      const resp = new Response(injectedBody, {
        status: 200,
        headers: { ...SITE_SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=600' },
      })
      cache.put(spaCacheKey, resp.clone())
      return resp
    }

    // CORS preflight — API 路徑統一處理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...SECURITY_HEADERS,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    if (path === '/api' || path === '/api/') return json(200, {
      status: 'operational', service: 'SEOBAIKE CaaS', version: '5.0.0',
      architecture: 'AI OS — 15 engines / 1300+ models / 500 tools / 14 channels',
      marketplace: { listings: 30, commission_levels: 3 },
      capabilities: {
        engines: 15, models: '1300+', tools: 500, channels: 14, api_endpoints: 62,
      },
      endpoints: {
        ai: ['/api/ai/providers', '/api/ai/models', '/api/ai/chat', '/api/ai/smart', '/api/ai/nim'],
        bots: ['/api/bots/status', '/api/bots/telegram/setup'],
        marketplace: ['/api/marketplace', '/api/marketplace/featured', '/api/marketplace/categories'],
        system: ['/api/health', '/api/platforms', '/api/v1/status'],
      },
      company: 'Xiao Lu Guang Ltd. (小路光有限公司)',
    })
    if (path === '/api/health') return json(200, { status: 'ok', timestamp: new Date().toISOString(), version: '3.2.0', platforms_ready: 14 })
    if (path === '/api/platforms') return json(200, PLATFORM_REGISTRY)

    // ── AI Engine Registry ──
    const AI_PROVIDERS: Record<string, { name: string; display_name: string; base_url: string; env_key: keyof Env; model_count: number; speed?: string; capability: string }> = {
      nvidia:     { name: 'NVIDIA NIM',    display_name: 'GPU Accelerated Engine',    base_url: 'https://integrate.api.nvidia.com/v1',                        env_key: 'NVIDIA_API_KEY',     model_count: 185, capability: 'Enterprise GPU inference' },
      openrouter: { name: 'OpenRouter',    display_name: 'Universal Gateway',         base_url: 'https://openrouter.ai/api/v1',                               env_key: 'OPENROUTER_API_KEY', model_count: 400, capability: 'Multi-model aggregator' },
      google:     { name: 'Google Gemini', display_name: 'Multimodal Engine',         base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',     env_key: 'GOOGLE_AI_KEY',      model_count: 15,  capability: 'Vision + reasoning' },
      groq:       { name: 'Groq',          display_name: 'Ultra-Speed Engine',        base_url: 'https://api.groq.com/openai/v1',                             env_key: 'GROQ_API_KEY',       model_count: 20,  speed: '500+ tok/s', capability: 'Low-latency inference' },
      together:   { name: 'Together AI',   display_name: 'Open-Source Hub',           base_url: 'https://api.together.xyz/v1',                                env_key: 'TOGETHER_API_KEY',   model_count: 200, capability: 'Open-source model hosting' },
      fireworks:  { name: 'Fireworks AI',  display_name: 'High-Speed Engine',         base_url: 'https://api.fireworks.ai/inference/v1',                       env_key: 'FIREWORKS_API_KEY',  model_count: 100, capability: 'Function calling + speed' },
      deepseek:   { name: 'DeepSeek',      display_name: 'Deep Reasoning Engine',     base_url: 'https://api.deepseek.com',                                   env_key: 'DEEPSEEK_API_KEY',   model_count: 5,   capability: 'Advanced chain-of-thought' },
      mistral:    { name: 'Mistral AI',    display_name: 'European Engine',           base_url: 'https://api.mistral.ai/v1',                                  env_key: 'MISTRAL_API_KEY',    model_count: 12,  capability: 'Efficient multilingual' },
      perplexity: { name: 'Perplexity',    display_name: 'Search Engine',             base_url: 'https://api.perplexity.ai',                                  env_key: 'PERPLEXITY_API_KEY', model_count: 8,   capability: 'Real-time web search' },
      cohere:     { name: 'Cohere',        display_name: 'Enterprise Search Engine',  base_url: 'https://api.cohere.ai/compatibility/v1',                     env_key: 'COHERE_API_KEY',     model_count: 6,   capability: 'RAG + semantic search' },
      anthropic:  { name: 'Anthropic',     display_name: 'Advanced Reasoning Engine', base_url: 'https://api.anthropic.com/v1',                               env_key: 'ANTHROPIC_API_KEY',  model_count: 6,   capability: 'Top-tier reasoning' },
      cloudflare: { name: 'Workers AI',    display_name: 'Edge Compute Engine',       base_url: 'workers-ai-built-in',                                        env_key: 'AI' as any,          model_count: 50,  capability: 'Zero-latency edge AI' },
      replicate:  { name: 'Replicate',     display_name: 'Model Deploy Engine',       base_url: 'https://api.replicate.com/v1',                               env_key: 'REPLICATE_API_KEY',  model_count: 100, capability: 'Custom model deployment' },
      huggingface:{ name: 'Hugging Face',  display_name: 'Community Engine',          base_url: 'https://api-inference.huggingface.co/models',                 env_key: 'HUGGINGFACE_API_KEY',model_count: 200, capability: 'Open-source ecosystem' },
      ai21:       { name: 'AI21 Labs',     display_name: 'Long Context Engine',       base_url: 'https://api.ai21.com/studio/v1',                              env_key: 'AI21_API_KEY',       model_count: 8,   capability: 'Extended context window' },
    }

    // ── /api/ai/providers — 瀏覽器訪問跳轉指揮中心，API 給摘要 ──
    if (path === '/api/ai/providers') {
      const accept = request.headers.get('Accept') || ''
      if (accept.includes('text/html')) {
        return new Response(null, { status: 302, headers: { 'Location': '/status', ...SECURITY_HEADERS } })
      }
      const online = Object.values(AI_PROVIDERS).filter(p => env[p.env_key]).length
      return json(200, {
        service: 'SEOBAIKE CaaS',
        status: 'operational',
        engines_online: online,
        uptime: '99.9%',
        timestamp: new Date().toISOString(),
      })
    }

    // ── /api/ai/models — 全供應商模型列表 ──
    if (path === '/api/ai/models') {
      const provider = url.searchParams.get('provider')
      const allModels: any[] = []
      const errors: any[] = []

      // 收集所有有 API Key 的供應商模型
      const fetchProviderModels = async (pid: string, p: typeof AI_PROVIDERS[string]) => {
        const key = env[p.env_key] as string
        if (!key || pid === 'cloudflare' || pid === 'anthropic' || pid === 'replicate' || pid === 'huggingface' || pid === 'ai21') return
        try {
          const res = await fetch(`${p.base_url}/models`, { headers: { 'Authorization': `Bearer ${key}` } })
          if (!res.ok) return
          const data = await res.json() as any
          const rawModels = Array.isArray(data) ? data : (data.data || [])
          const models = rawModels.map((m: any) => ({ id: m.id, provider: pid, provider_name: p.name, owned_by: m.owned_by || m.organization || m.id.split('/')[0], created: m.created }))
          allModels.push(...models)
        } catch (e: any) { errors.push({ provider: pid, error: e.message }) }
      }

      if (provider && AI_PROVIDERS[provider]) {
        await fetchProviderModels(provider, AI_PROVIDERS[provider])
      } else {
        // 同時查詢所有供應商
        await Promise.all(Object.entries(AI_PROVIDERS).map(([pid, p]) => fetchProviderModels(pid, p)))
      }

      // 加入 Anthropic 模型（格式不同，手動加入）
      if (!provider || provider === 'anthropic') {
        if (env.ANTHROPIC_API_KEY) {
          allModels.push(
            { id: 'claude-opus-4-6', provider: 'anthropic', provider_name: 'Anthropic', owned_by: 'anthropic' },
            { id: 'claude-opus-4-5-20250819', provider: 'anthropic', provider_name: 'Anthropic', owned_by: 'anthropic' },
            { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic', provider_name: 'Anthropic', owned_by: 'anthropic' },
            { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', provider_name: 'Anthropic', owned_by: 'anthropic' },
            { id: 'claude-3-5-sonnet-20241022', provider: 'anthropic', provider_name: 'Anthropic', owned_by: 'anthropic' },
            { id: 'claude-3-5-haiku-20241022', provider: 'anthropic', provider_name: 'Anthropic', owned_by: 'anthropic' },
          )
        }
      }

      // 靜態模型列表 — API 回不了的供應商用靜態補齊（只在 live 沒拿到時才補）
      if ((!provider || provider === 'together') && !allModels.some(m => m.provider === 'together')) {
        if (env.TOGETHER_API_KEY) {
          const togetherModels = [
            'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
            'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3-8B-Instruct-Turbo',
            'mistralai/Mixtral-8x22B-Instruct-v0.1', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'mistralai/Mistral-7B-Instruct-v0.3',
            'Qwen/Qwen2.5-72B-Instruct-Turbo', 'Qwen/Qwen2.5-7B-Instruct-Turbo', 'Qwen/QwQ-32B',
            'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B', 'deepseek-ai/DeepSeek-V3',
            'google/gemma-2-27b-it', 'google/gemma-2-9b-it', 'databricks/dbrx-instruct',
            'microsoft/WizardLM-2-8x22B', 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
            'togethercomputer/StripedHyena-Nous-7B', 'allenai/OLMo-7B-Instruct',
            'black-forest-labs/FLUX.1-schnell', 'stabilityai/stable-diffusion-xl-base-1.0',
          ]
          togetherModels.forEach(id => allModels.push({ id, provider: 'together', provider_name: 'Together AI', owned_by: id.split('/')[0] }))
        }
      }

      if (!provider || provider === 'mistral') {
        if (env.MISTRAL_API_KEY) {
          const mistralModels = [
            'mistral-large-latest', 'mistral-small-latest', 'mistral-medium-latest',
            'codestral-latest', 'magistral-medium-2506', 'magistral-small-2506',
            'mistral-embed', 'mistral-moderation-latest', 'pixtral-large-latest',
            'pixtral-12b-2409', 'open-mistral-nemo', 'open-codestral-mamba',
          ]
          mistralModels.forEach(id => allModels.push({ id, provider: 'mistral', provider_name: 'Mistral AI', owned_by: 'mistralai' }))
        }
      }

      if (!provider || provider === 'perplexity') {
        if (env.PERPLEXITY_API_KEY) {
          const pplxModels = [
            'sonar', 'sonar-pro', 'sonar-reasoning', 'sonar-reasoning-pro',
            'sonar-deep-research', 'r1-1776',
            'sonar-chat', 'sonar-medium-chat',
          ]
          pplxModels.forEach(id => allModels.push({ id, provider: 'perplexity', provider_name: 'Perplexity', owned_by: 'perplexity' }))
        }
      }

      // 加入 Cloudflare Workers AI 模型（50+ 免費）
      if (!provider || provider === 'cloudflare') {
        const cfModels = [
          '@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.1-70b-instruct', '@cf/meta/llama-3-8b-instruct',
          '@cf/meta/llama-3.2-3b-instruct', '@cf/meta/llama-3.2-1b-instruct', '@cf/meta/llama-2-7b-chat-fp16',
          '@cf/mistral/mistral-7b-instruct-v0.2', '@cf/mistral/mistral-7b-instruct-v0.1',
          '@cf/google/gemma-7b-it', '@cf/google/gemma-2b-it',
          '@cf/qwen/qwen1.5-14b-chat-awq', '@cf/qwen/qwen1.5-7b-chat-awq', '@cf/qwen/qwen1.5-1.8b-chat',
          '@cf/microsoft/phi-2', '@cf/microsoft/phi-3-mini-4k-instruct',
          '@cf/deepseek-ai/deepseek-math-7b-instruct', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
          '@cf/tiiuae/falcon-7b-instruct', '@cf/thebloke/discolm-german-7b-v1-awq',
          '@cf/tinyllama/tinyllama-1.1b-chat-v1.0', '@cf/openchat/openchat-3.5-0106',
          '@cf/defog/sqlcoder-7b-2', '@cf/nexusflow/starling-lm-7b-beta',
          '@cf/baai/bge-base-en-v1.5', '@cf/baai/bge-large-en-v1.5', '@cf/baai/bge-small-en-v1.5',
          '@cf/huggingface/distilbert-sst-2-int8', '@cf/microsoft/resnet-50',
          '@cf/stabilityai/stable-diffusion-xl-base-1.0', '@cf/bytedance/stable-diffusion-xl-lightning',
          '@cf/lykon/dreamshaper-8-lcm', '@cf/openai/whisper', '@cf/openai/whisper-tiny-en',
        ]
        cfModels.forEach(id => {
          const owner = id.replace('@cf/', '').split('/')[0]
          allModels.push({ id, provider: 'cloudflare', provider_name: 'Workers AI', owned_by: owner })
        })
      }

      // 統計
      const byProvider: Record<string, number> = {}
      allModels.forEach(m => { byProvider[m.provider] = (byProvider[m.provider] || 0) + 1 })

      return json(200, {
        total: allModels.length, source: 'SEOBAIKE CaaS',         engines: Object.entries(byProvider).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
        models: allModels,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // ── /api/ai/nim — NVIDIA NIM 專用入口 ──
    if (path === '/api/ai/nim' && request.method === 'GET') {
      return json(200, { info: 'SEOBAIKE CaaS — AI Inference Gateway', method: 'POST', endpoint: '/api/ai/nim', engines: Object.keys(AI_PROVIDERS), body: { provider: 'nvidia', model: 'auto', message: 'your question' } })
    }

    // ── Azure OpenAI — GPT-4o 重運算入口 ──
    if (path === '/api/ai/azure' && request.method === 'POST') {
      const body = await request.json() as any
      const { message, system } = body
      if (!message) return json(400, { error: 'message required' })
      const reply = await callAzureOpenAI(env as any, [
        { role: 'system', content: system || '你是 SEOBAIKE AI 助理，繁體中文回答。' },
        { role: 'user', content: message }
      ], body.max_tokens || 1000)
      if (reply) return json(200, { reply, engine: 'azure-openai-gpt4o', source: 'seobaike-ai' })
      return json(503, { error: 'Azure OpenAI 尚未設定，請聯繫管理員' })
    }

    // ── Azure Speech TTS — AI 配音（繁體中文最強）──
    if (path === '/api/ai/speech' && request.method === 'POST') {
      const body = await request.json() as any
      const { text, voice } = body
      if (!text) return json(400, { error: 'text required' })
      const audio = await azureSpeechTTS(env as any, text, voice || 'zh-TW-HsiaoChenNeural')
      if (audio) {
        return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' } })
      }
      return json(503, { error: 'Azure Speech 尚未設定，請聯繫管理員' })
    }

    // ── Bing Search — SEO 排名查詢 ──
    if (path === '/api/seo/bing' && request.method === 'POST') {
      const body = await request.json() as any
      const { query, count } = body
      if (!query) return json(400, { error: 'query required' })
      const results = await bingSearch(env as any, query, count || 10)
      if (results) return json(200, { results, query, source: 'bing-search', count: results.length })
      return json(503, { error: 'Bing Search 尚未設定，請聯繫管理員' })
    }

    // ── Composio MCP — 500+ 應用直連 ──
    if (path === '/api/mcp/tools') {
      const COMP_KEY = env.COMPOSIO_API_KEY
      if (!COMP_KEY) return json(200, {
        status: 'os_ready', source: 'composio-mcp', total_available: 500,
        message: 'SEOBAIKE OS 已就緒，Composio MCP 500+ 工具等待連入',
        categories: ['communication', 'productivity', 'development', 'marketing', 'finance', 'social', 'analytics', 'storage', 'crm', 'project_management'],
        featured: [
          { name: 'Slack', category: 'communication', description: '團隊溝通 + 頻道管理' },
          { name: 'GitHub', category: 'development', description: '程式碼倉庫 + PR + Issues' },
          { name: 'Notion', category: 'productivity', description: '筆記 + 知識庫 + 任務管理' },
          { name: 'Google Workspace', category: 'productivity', description: 'Gmail + Sheets + Drive + Calendar' },
          { name: 'Salesforce', category: 'crm', description: '客戶關係管理 + 銷售漏斗' },
          { name: 'HubSpot', category: 'marketing', description: '行銷自動化 + CRM' },
          { name: 'Stripe', category: 'finance', description: '支付處理 + 訂閱管理' },
          { name: 'Shopify', category: 'commerce', description: '電商平台 + 訂單管理' },
          { name: 'Jira', category: 'project_management', description: '專案管理 + 敏捷開發' },
          { name: 'Figma', category: 'design', description: '設計協作 + 原型製作' },
          { name: 'Meta (WhatsApp/Instagram)', category: 'social', description: '社群媒體 + 訊息' },
          { name: 'TikTok', category: 'social', description: '短影片 + 行銷' },
          { name: 'X (Twitter)', category: 'social', description: '社群媒體 + 即時消息' },
          { name: 'LinkedIn', category: 'social', description: '專業社群 + 招募' },
          { name: 'AWS', category: 'cloud', description: '雲端服務 + 基礎設施' },
        ],
        setup: 'composio.dev → 取得 API Key → wrangler secret put COMPOSIO_API_KEY',
      })
      try {
        const res = await fetch('https://backend.composio.dev/api/v3/mcp/servers', {
          headers: { 'x-api-key': COMP_KEY, 'Content-Type': 'application/json' },
        })
        const data = await res.json()
        return json(200, { source: 'composio-mcp', data })
      } catch (e: any) { return json(500, { error: e.message }) }
    }
    if (path === '/api/mcp/execute' && request.method === 'POST') {
      const COMP_KEY = env.COMPOSIO_API_KEY
      if (!COMP_KEY) return json(503, { error: 'COMPOSIO_API_KEY not configured', setup: 'composio.dev → API Key → wrangler secret put COMPOSIO_API_KEY' })
      const body = await request.json() as any
      if (!body.action) return json(400, { error: 'action is required', example: { action: 'GITHUB_CREATE_ISSUE', params: { repo: 'owner/repo', title: 'Bug fix' } } })
      try {
        const res = await fetch('https://backend.composio.dev/api/v3/actions/execute', {
          method: 'POST',
          headers: { 'x-api-key': COMP_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: body.action, params: body.params || {} }),
        })
        const data = await res.json()
        return json(200, { source: 'composio-mcp', action: body.action, result: data })
      } catch (e: any) { return json(500, { error: e.message }) }
    }

    // ── 協作機器人狀態 API ──
    if (path === '/api/bots/status') {
      const bots = [
        { id: 'telegram', name: 'Telegram', icon: '📱', has_token: !!env.TELEGRAM_BOT_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/telegram', setup_url: 'https://t.me/BotFather', token_keys: ['TELEGRAM_BOT_TOKEN'], features: ['inline keyboard', 'AI 對話', '審批系統', '行業約束'] },
        { id: 'line', name: 'LINE', icon: '💚', has_token: !!env.LINE_CHANNEL_SECRET, webhook: 'https://aiforseo.vip/api/webhook/line', setup_url: 'https://developers.line.biz/', token_keys: ['LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN'], features: ['reply + push', 'AI 對話', '審批系統'] },
        { id: 'discord', name: 'Discord', icon: '🎮', has_token: !!env.DISCORD_BOT_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/discord', setup_url: 'https://discord.com/developers', token_keys: ['DISCORD_BOT_TOKEN', 'DISCORD_PUBLIC_KEY', 'DISCORD_APPLICATION_ID'], features: ['slash command', 'interaction', 'AI 對話', '審批系統'] },
        { id: 'slack', name: 'Slack', icon: '💼', has_token: !!env.SLACK_BOT_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/slack', setup_url: 'https://api.slack.com/apps', token_keys: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'], features: ['Events API', 'thread 回覆', 'DM 推送', 'AI 對話'] },
        { id: 'whatsapp', name: 'WhatsApp', icon: '📞', has_token: !!env.WHATSAPP_ACCESS_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/whatsapp', setup_url: 'https://developers.facebook.com/', token_keys: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'], features: ['Meta Cloud API', 'AI 對話'] },
        { id: 'messenger', name: 'Messenger', icon: '💬', has_token: !!env.MESSENGER_PAGE_ACCESS_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/messenger', setup_url: 'https://developers.facebook.com/', token_keys: ['MESSENGER_PAGE_ACCESS_TOKEN', 'MESSENGER_APP_SECRET', 'MESSENGER_VERIFY_TOKEN'], features: ['Page 訊息', 'AI 對話'] },
        { id: 'teams', name: 'Teams', icon: '🏢', has_token: !!env.TEAMS_BOT_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/teams', setup_url: 'https://dev.teams.microsoft.com/', token_keys: ['TEAMS_BOT_TOKEN', 'TEAMS_APP_ID'], features: ['Bot Framework', 'AI 對話'] },
        { id: 'email', name: 'Email', icon: '📧', has_token: !!env.EMAIL_API_KEY, webhook: 'https://aiforseo.vip/api/webhook/email', setup_url: 'https://sendgrid.com/', token_keys: ['EMAIL_API_KEY', 'EMAIL_WEBHOOK_SECRET'], features: ['收發信件', 'AI 自動回覆'] },
        { id: 'google_chat', name: 'Google Chat', icon: '🔵', has_token: !!env.GOOGLE_CHAT_BOT_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/google-chat', setup_url: 'https://console.cloud.google.com/', token_keys: ['GOOGLE_CHAT_BOT_TOKEN', 'GOOGLE_CHAT_PROJECT_ID'], features: ['Space 訊息', 'AI 對話'] },
        { id: 'wechat', name: 'WeChat', icon: '🟢', has_token: !!env.WECHAT_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/wechat', setup_url: 'https://mp.weixin.qq.com/', token_keys: ['WECHAT_APP_ID', 'WECHAT_APP_SECRET', 'WECHAT_TOKEN'], features: ['公眾號', 'AI 對話'] },
        { id: 'signal', name: 'Signal', icon: '🔒', has_token: !!env.SIGNAL_REST_API_URL, webhook: 'https://aiforseo.vip/api/webhook/signal', setup_url: 'https://signal.org/', token_keys: ['SIGNAL_BOT_NUMBER', 'SIGNAL_REST_API_URL'], features: ['端對端加密', 'AI 對話'] },
        { id: 'viber', name: 'Viber', icon: '💜', has_token: !!env.VIBER_AUTH_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/viber', setup_url: 'https://partners.viber.com/', token_keys: ['VIBER_AUTH_TOKEN'], features: ['Bot API', 'AI 對話'] },
        { id: 'sms', name: 'SMS', icon: '📱', has_token: !!env.TWILIO_AUTH_TOKEN, webhook: 'https://aiforseo.vip/api/webhook/sms', setup_url: 'https://www.twilio.com/', token_keys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'], features: ['全球簡訊', 'AI 對話'] },
        { id: 'web_widget', name: 'Web Widget', icon: '🌐', has_token: true, webhook: 'https://aiforseo.vip/api/webhook/web-widget', setup_url: 'https://aiforseo.vip/docs', token_keys: [], features: ['網頁嵌入', 'AI 對話', '即時回覆'] },
      ]
      const online = bots.filter(b => b.has_token).length
      const total = bots.length
      return json(200, {
        status: 'operational', total_bots: total, online_bots: online, offline_bots: total - online,
        timestamp: new Date().toISOString(),
        bots: bots.map(b => ({ ...b, status: b.has_token ? 'online' : 'awaiting_token' })),
      })
    }
    // ── Telegram Webhook 設定 ──
    if (path === '/api/bots/telegram/setup' && request.method === 'POST') {
      if (!env.TELEGRAM_BOT_TOKEN) return json(400, { error: 'TELEGRAM_BOT_TOKEN not configured' })
      const webhookUrl = 'https://aiforseo.vip/api/webhook/telegram'
      const tgRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'], secret_token: env.TELEGRAM_SECRET_TOKEN || undefined }),
      })
      const tgData = await tgRes.json()
      return json(200, { success: true, webhook_url: webhookUrl, telegram_response: tgData })
    }
    if (path === '/api/bots/telegram/info' && request.method === 'GET') {
      if (!env.TELEGRAM_BOT_TOKEN) return json(400, { error: 'TELEGRAM_BOT_TOKEN not configured' })
      const [me, wh] = await Promise.all([
        fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`).then(r => r.json()),
        fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`).then(r => r.json()),
      ])
      return json(200, { bot: me, webhook: wh })
    }
    // ── 協作機器人測試（向 Telegram 發送測試訊息） ──
    if (path === '/api/bots/telegram/test' && request.method === 'POST') {
      if (!env.TELEGRAM_BOT_TOKEN) return json(400, { error: 'TELEGRAM_BOT_TOKEN not configured' })
      const body = await request.json() as any
      const chatId = body.chat_id || '5372713163'
      await replyTelegram(chatId, {
        text: '🟢 SEOBAIKE 協作機器人測試成功！\n\n這是來自 SEOBAIKE OS 的測試訊息。\n系統已上線，隨時為您服務。\n\n— SEOBAIKE CaaS',
        buttons: [
          [{ text: '📊 系統狀態', callback_data: '/status' }, { text: '💰 今日營收', callback_data: '/revenue' }],
          [{ text: '🛒 市集', callback_data: '/marketplace' }, { text: '🏠 主選單', callback_data: '/start' }],
        ],
      }, env.TELEGRAM_BOT_TOKEN)
      return json(200, { success: true, message: 'Test message sent to Telegram', chat_id: chatId })
    }

    // ── Pages 代理：生態系統儀表板 + Widget（從 GitHub Raw 取內容） ──
    const PAGES_MAP: Record<string, { file: string; type: string }> = {
      '/api/ecosystem': { file: 'pages-site/ecosystem.html', type: 'text/html; charset=utf-8' },
      '/api/widget.js': { file: 'pages-site/seobaike-widget.js', type: 'application/javascript; charset=utf-8' },
    }
    if (PAGES_MAP[path]) {
      const { file, type } = PAGES_MAP[path]
      const rawRes = await fetch(`https://raw.githubusercontent.com/icanforyouthebest-bot/SEOBAIKE/master/${file}`)
      return new Response(rawRes.body, {
        status: rawRes.status,
        headers: { ...SECURITY_HEADERS, 'Content-Type': type, 'Cache-Control': 'public, max-age=600' },
      })
    }

    // ── /api/v1/* 公開資料路由 → 從 Supabase REST 代理 ──
    const SUPA_URL = env.SUPABASE_URL || 'https://vmyrivxxibqydccurxug.supabase.co'
    const SUPA_KEY = env.SUPABASE_ANON_KEY
    const supaHeaders = { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }

    if (path === '/api/v1/status') {
      return json(200, { status: 'operational', version: '3.0.0', timestamp: new Date().toISOString(), services: { workers: 'ok', supabase: 'ok', edge_functions: 'ok' } })
    }
    if (path === '/api/v1/nodes') {
      const [l1, l2, l3, l4] = await Promise.all([
        fetch(`${SUPA_URL}/rest/v1/l1_categories?select=id,code,name_zh,name_en`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
        fetch(`${SUPA_URL}/rest/v1/l2_subcategories?select=id,code,name_zh,name_en&limit=100`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
        fetch(`${SUPA_URL}/rest/v1/l3_processes?select=id,code,name_zh,name_en&limit=100`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
        fetch(`${SUPA_URL}/rest/v1/l4_nodes?select=id,code,name_zh,name_en&limit=100`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
      ])
      return json(200, { total: (l1 as any[]).length + (l2 as any[]).length + (l3 as any[]).length + (l4 as any[]).length, layers: { l1: (l1 as any[]).length, l2: (l2 as any[]).length, l3: (l3 as any[]).length, l4: (l4 as any[]).length } })
    }
    if (path === '/api/v1/l1') {
      const res = await fetch(`${SUPA_URL}/rest/v1/l1_categories?select=id,code,name_zh,name_en,tsic_code,naics_code,nace_code,jsic_code`, { headers: supaHeaders })
      const data = await res.json()
      return json(200, { count: (data as any[]).length, data })
    }
    if (path === '/api/v1/l2') {
      const limit = url.searchParams.get('limit') || '100'
      const res = await fetch(`${SUPA_URL}/rest/v1/l2_subcategories?select=id,code,name_zh,name_en,l1_id&limit=${limit}`, { headers: supaHeaders })
      const data = await res.json()
      return json(200, { count: (data as any[]).length, data })
    }
    if (path === '/api/v1/l3') {
      const limit = url.searchParams.get('limit') || '100'
      const res = await fetch(`${SUPA_URL}/rest/v1/l3_processes?select=id,code,name_zh,name_en,l2_id&limit=${limit}`, { headers: supaHeaders })
      const data = await res.json()
      return json(200, { count: (data as any[]).length, data })
    }
    if (path === '/api/v1/l4') {
      const limit = url.searchParams.get('limit') || '100'
      const res = await fetch(`${SUPA_URL}/rest/v1/l4_nodes?select=id,code,name_zh,name_en,l3_id&limit=${limit}`, { headers: supaHeaders })
      const data = await res.json()
      return json(200, { count: (data as any[]).length, data })
    }
    if (path === '/api/v1/check' && request.method === 'GET') {
      return json(200, { info: 'Use POST /api/v1/check to validate inference path', method: 'POST', examples: [{ mode: 'uuid', body: { l1_id: 'uuid', l2_id: 'uuid', l3_id: 'uuid', l4_id: 'uuid' } }, { mode: 'code', body: { l1_code: 'L1-01', l4_code: 'L4-01010101' } }] })
    }
    if (path === '/api/v1/inference' && request.method === 'GET') {
      return json(200, { info: 'Use POST /api/v1/inference with body {"message":"your query","l4_node":"code"} to run constrained inference', method: 'POST' })
    }
    if (path === '/api/docs') {
      return Response.redirect(`${url.origin}/docs`, 301)
    }

    // ── 市集 API（GET）— 讓人賺錢的核心 ──
    if (path === '/api/marketplace' || path === '/api/marketplace/') {
      const category = url.searchParams.get('category')
      const q = url.searchParams.get('q')
      const featured = url.searchParams.get('featured')
      let query = `${SUPA_URL}/rest/v1/marketplace_listings?status=eq.active&select=id,title,subtitle,description,price_twd,pricing_model,category,icon,tags,total_users,avg_rating,review_count,featured,api_endpoint&order=total_users.desc`
      if (category) query += `&category=eq.${encodeURIComponent(category)}`
      if (featured === 'true') query += `&featured=eq.true`
      if (q) query += `&or=(title.ilike.*${encodeURIComponent(q)}*,description.ilike.*${encodeURIComponent(q)}*,category.ilike.*${encodeURIComponent(q)}*)`
      query += '&limit=50'
      const data = await fetch(query, { headers: supaHeaders }).then(r => r.json()).catch(() => [])
      const categories = [...new Set((data as any[]).map((d: any) => d.category).filter(Boolean))]
      return json(200, { total: (data as any[]).length, categories, commission_model: { platform: '20%', creator: '50%', referrer_l1: '15%', referrer_l2: '10%', referrer_l3: '5%' }, listings: data })
    }
    if (path === '/api/marketplace/featured') {
      const data = await fetch(`${SUPA_URL}/rest/v1/marketplace_listings?status=eq.active&featured=eq.true&select=id,title,subtitle,price_twd,pricing_model,category,icon,total_users,avg_rating&order=total_users.desc&limit=10`, { headers: supaHeaders }).then(r => r.json()).catch(() => [])
      return json(200, { featured: data })
    }
    if (path.startsWith('/api/marketplace/listing/')) {
      const listingId = path.split('/').pop()
      const [listing, reviews] = await Promise.all([
        fetch(`${SUPA_URL}/rest/v1/marketplace_listings?id=eq.${listingId}&select=*`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
        fetch(`${SUPA_URL}/rest/v1/marketplace_reviews?listing_id=eq.${listingId}&select=*&order=created_at.desc&limit=20`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
      ])
      if (!(listing as any[]).length) return json(404, { error: 'Listing not found' })
      return json(200, { listing: (listing as any[])[0], reviews, review_count: (reviews as any[]).length })
    }
    if (path === '/api/marketplace/categories') {
      const data = await fetch(`${SUPA_URL}/rest/v1/marketplace_listings?status=eq.active&select=category`, { headers: supaHeaders }).then(r => r.json()).catch(() => [])
      const cats: Record<string, number> = {}
      ;(data as any[]).forEach((d: any) => { if (d.category) cats[d.category] = (cats[d.category] || 0) + 1 })
      return json(200, { categories: Object.entries(cats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) })
    }
    if (path === '/api/commission/rules') {
      return json(200, { model: 'SEOBAIKE 三級分潤', rules: [
        { role: 'platform', percentage: 20, description: 'SEOBAIKE 平台服務費' },
        { role: 'creator', percentage: 50, description: '創作者收入（工具開發者）' },
        { role: 'referrer_l1', percentage: 15, description: '直推獎金（你推薦的人買了，你賺 15%）' },
        { role: 'referrer_l2', percentage: 10, description: '間推獎金（你的下線推薦的人買了，你賺 10%）' },
        { role: 'referrer_l3', percentage: 5, description: '三級獎金（再下一級買了，你賺 5%）' },
      ], total: '100%', note: '分享就賺錢，每個人都是推廣者' })
    }
    if (path === '/api/wallet' && request.method === 'GET') {
      const userId = url.searchParams.get('user_id')
      if (!userId) return json(400, { error: 'user_id is required' })
      const wallet = await fetch(`${SUPA_URL}/rest/v1/user_wallets?user_id=eq.${userId}&select=*`, { headers: supaHeaders }).then(r => r.json()).catch(() => [])
      const commissions = await fetch(`${SUPA_URL}/rest/v1/marketplace_commission_splits?recipient_id=eq.${userId}&select=*&order=created_at.desc&limit=20`, { headers: supaHeaders }).then(r => r.json()).catch(() => [])
      const referrals = await fetch(`${SUPA_URL}/rest/v1/referral_tree?referrer_id=eq.${userId}&select=*`, { headers: supaHeaders }).then(r => r.json()).catch(() => [])
      return json(200, { wallet: (wallet as any[])[0] || { balance_twd: 0, total_earned_twd: 0 }, recent_commissions: commissions, total_referrals: (referrals as any[]).length })
    }

    // ── 系統分析 API（GET）— OS 基礎建設 ──
    if (path === '/api/v1/analytics') {
      const ct = async (t: string): Promise<number> => {
        try {
          const r = await fetch(`${SUPA_URL}/rest/v1/${t}?select=id`, { headers: { ...supaHeaders, 'Prefer': 'count=exact', 'Range': '0-0' } })
          return parseInt(r.headers.get('content-range')?.split('/')[1] || '0')
        } catch { return 0 }
      }
      const [l1, l2, l3, l4, listings, purchases, creators, views, audits] = await Promise.all([
        ct('l1_categories'), ct('l2_subcategories'), ct('l3_processes'), ct('l4_nodes'),
        ct('marketplace_listings'), ct('marketplace_purchases'), ct('creator_profiles'),
        ct('page_views'), ct('audit_logs'),
      ])
      return json(200, {
        timestamp: new Date().toISOString(),
        constraint_nodes: { l1, l2, l3, l4, total: l1 + l2 + l3 + l4 },
        marketplace: { listings, purchases, creators },
        activity: { page_views: views, audit_logs: audits },
        ecosystem: { platforms: 14, ai_models: 3, edge_functions: 8, api_endpoints: 45 },
      })
    }
    if (path === '/api/v1/search') {
      const q = url.searchParams.get('q')
      if (!q) return json(400, { error: 'q parameter is required', example: '/api/v1/search?q=農業' })
      const searchIn = async (table: string, fields: string) => {
        const u = new URL(`${SUPA_URL}/rest/v1/${table}`)
        u.searchParams.set('or', `(name_zh.ilike.*${q}*,name_en.ilike.*${q}*,code.ilike.*${q}*)`)
        u.searchParams.set('select', fields)
        u.searchParams.set('limit', '20')
        return fetch(u.toString(), { headers: supaHeaders }).then(r => r.json()).catch(() => [])
      }
      const [r1, r2, r3, r4, market] = await Promise.all([
        searchIn('l1_categories', 'id,code,name_zh,name_en'),
        searchIn('l2_subcategories', 'id,code,name_zh,name_en,l1_id'),
        searchIn('l3_processes', 'id,code,name_zh,name_en,l2_id'),
        searchIn('l4_nodes', 'id,code,name_zh,name_en,l3_id'),
        fetch(`${SUPA_URL}/rest/v1/marketplace_listings?status=eq.active&or=(title.ilike.*${encodeURIComponent(q)}*,description.ilike.*${encodeURIComponent(q)}*,category.ilike.*${encodeURIComponent(q)}*)&select=id,title,category,icon,price_twd&limit=10`, { headers: supaHeaders }).then(r => r.json()).catch(() => []),
      ])
      const total = (r1 as any[]).length + (r2 as any[]).length + (r3 as any[]).length + (r4 as any[]).length + (market as any[]).length
      return json(200, { query: q, total_results: total, results: { l1: r1, l2: r2, l3: r3, l4: r4, marketplace: market } })
    }
    if (path === '/api/v1/system') {
      const t0 = Date.now()
      const checks = await Promise.all([
        Promise.resolve({ service: 'workers', status: 'operational', ms: 0 }),
        fetch(`${SUPA_URL}/rest/v1/l1_categories?select=id&limit=1`, { headers: supaHeaders }).then(r => ({ service: 'supabase', status: r.ok ? 'operational' : 'degraded', ms: Date.now() - t0 })).catch(() => ({ service: 'supabase', status: 'down', ms: Date.now() - t0 })),
        fetch(`${SUPA_URL}/rest/v1/marketplace_listings?select=id&limit=1`, { headers: supaHeaders }).then(r => ({ service: 'marketplace', status: r.ok ? 'operational' : 'degraded', ms: Date.now() - t0 })).catch(() => ({ service: 'marketplace', status: 'down', ms: Date.now() - t0 })),
        env.AI ? env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages: [{ role: 'user', content: 'ping' }], max_tokens: 3 }).then(() => ({ service: 'ai-engine', status: 'operational', ms: Date.now() - t0 })).catch(() => ({ service: 'ai-engine', status: 'degraded', ms: Date.now() - t0 })) : Promise.resolve({ service: 'ai-engine', status: 'not_configured', ms: 0 }),
      ])
      return json(200, { status: checks.every(c => c.status === 'operational') ? 'all_operational' : 'degraded', timestamp: new Date().toISOString(), latency_ms: Date.now() - t0, services: checks, capabilities: { ai_models: 3, platforms: 14, marketplace_listings: 20, commission_levels: 3 } })
    }
    if (path === '/api/v1/export') {
      const layer = url.searchParams.get('layer') || 'all'
      const tbl: Record<string, string> = { l1: 'l1_categories?select=code,name_zh,name_en,tsic_code,naics_code,nace_code,jsic_code&order=code', l2: 'l2_subcategories?select=code,name_zh,name_en,l1_id&order=code&limit=1000', l3: 'l3_processes?select=code,name_zh,name_en,l2_id&order=code&limit=1000', l4: 'l4_nodes?select=code,name_zh,name_en,l3_id&order=code&limit=1000' }
      if (layer !== 'all' && !tbl[layer]) return json(400, { error: 'Invalid layer. Use: l1, l2, l3, l4, or all' })
      const layers = layer === 'all' ? ['l1', 'l2', 'l3', 'l4'] : [layer]
      const results = await Promise.all(layers.map(l => fetch(`${SUPA_URL}/rest/v1/${tbl[l]}`, { headers: supaHeaders }).then(r => r.json()).catch(() => [])))
      const data: Record<string, any> = {}
      layers.forEach((l, i) => { data[l] = results[i] })
      return json(200, { exported_at: new Date().toISOString(), layer, data })
    }

    if (request.method === 'GET') {
      if (path === '/api/chat') {
        return new Response('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>SEOBAIKE Chat</title></head><body style="margin:0;background:#0a0a1a;color:#eee;font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;"><div style="text-align:center;"><h1 style="color:#e8850c;">SEOBAIKE Chat</h1><p>請使用 <a href="/dashboard" style="color:#76b900;">/dashboard</a> 或 <a href="/api/ai/chat" style="color:#76b900;">API</a> 進行對話</p></div></body></html>', { status: 200, headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } })
      }
      if (path === '/api/compliance-badge') return await handleComplianceBadge(env, url)
      if (path === '/api/webhook/whatsapp') {
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')
        if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) return new Response(challenge, { status: 200, headers: SECURITY_HEADERS })
        return new Response('Forbidden', { status: 403, headers: SECURITY_HEADERS })
      }
      if (path === '/api/webhook/messenger') {
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')
        if (mode === 'subscribe' && token === env.MESSENGER_VERIFY_TOKEN) return new Response(challenge, { status: 200, headers: SECURITY_HEADERS })
        return new Response('Forbidden', { status: 403, headers: SECURITY_HEADERS })
      }
      return json(404, { error: 'Not found' })
    }

    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' })

    // ── Rate Limiting ──
    const strictRatePaths = ['/api/ai/chat', '/api/ai/smart', '/api/v1/check', '/api/v1/inference', '/api/checkout', '/api/ai/router', '/api/ai/search', '/api/ai/content', '/api/bot/command', '/api/team/dispatch', '/api/marketplace/purchase', '/api/marketplace/create', '/api/marketplace/review']
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown'
    if (strictRatePaths.includes(path)) {
      const { allowed, retryAfter } = await checkRateLimit(env.RATE_LIMIT, `${clientIp}:${path}`, 5)
      if (!allowed) return json(429, { error: '請求過於頻繁，請稍後再試', retry_after: retryAfter })
    }
    // widget-chat 寬鬆限制（2 秒冷卻，讓客服可以正常對話）
    if (path === '/api/widget-chat') {
      const { allowed, retryAfter } = await checkRateLimit(env.RATE_LIMIT, `${clientIp}:widget`, 2)
      if (!allowed) return json(429, { error: '請稍等一下再發送', retry_after: retryAfter })
    }

    try {
      switch (path) {
        case '/api/webhook/line': return await handleWebhook(request, env, 'line')
        case '/api/webhook/telegram': return await handleTelegram(request, env)
        case '/api/webhook/whatsapp': return await handleWebhook(request, env, 'whatsapp')
        case '/api/webhook/messenger': return await handleWebhook(request, env, 'messenger')
        case '/api/webhook/discord': return await handleDiscord(request, env)
        case '/api/webhook/slack': return await handleSlack(request, env)
        case '/api/webhook/teams': return await handleTeamsWebhook(request, env)
        case '/api/webhook/email': return await handleEmailWebhook(request, env)
        case '/api/webhook/google-chat': return await handleGoogleChatWebhook(request, env)
        case '/api/webhook/wechat': return await handleWechatWebhook(request, env)
        case '/api/webhook/signal': return await handleSignalWebhook(request, env)
        case '/api/webhook/viber': return await handleViberWebhook(request, env)
        case '/api/webhook/sms': return await handleSmsWebhook(request, env)
        case '/api/webhook/web-widget': return await handleWebWidgetWebhook(request, env)
        case '/api/gateway': return await handleGateway(request, env)
        case '/api/ai/chat': return await handleAiChat(request, env)
        case '/api/ai/nim': return await handleNimChat(request, env)
        case '/api/widget-chat': return await handleWidgetChatSmart(request, env)
        case '/api/ai/smart': return await handleSmartRouter(request, env)
        // ── SEOBAIKE 世界級 API 路由 ──
        case '/api/ai/router': return await proxyEdge(request, env, 'ai-universal-router')
        case '/api/ai/search': return await proxyEdge(request, env, 'ai-search-engine')
        case '/api/ai/content': return await proxyEdge(request, env, 'ai-content-factory')
        case '/api/bot/command': return await proxyEdge(request, env, 'bot-commander')
        case '/api/team/dispatch': return await proxyEdge(request, env, 'team-orchestrator')
        case '/api/checkout': return await handleStripeCheckout(request, env)
        case '/api/webhook/stripe': return await handleStripeWebhook(request, env)
        case '/api/send-email': return await handleSendEmail(request, env)
        case '/api/v1/check': {
          const body = await request.json() as any
          if (!body.l1_id && !body.l1_code) return json(400, { error: 'l1_id (uuid) or l1_code (e.g. L1-01) is required', example: { l1_code: 'L1-01', l4_code: 'L4-01010101' } })
          let l1Id = body.l1_id, l2Id = body.l2_id, l3Id = body.l3_id, l4Id = body.l4_id
          // 如果用 code 而不是 uuid，先查 ID
          if (body.l1_code && !l1Id) {
            const lookupRes = await fetch(`${SUPA_URL}/rest/v1/rpc/check_inference_path`, {
              method: 'POST', headers: { ...supaHeaders, 'Content-Type': 'application/json' },
              body: JSON.stringify({ p_session_id: body.session_id || 'api-' + Date.now(), p_l1_id: null, p_l2_id: null, p_l3_id: null, p_l4_id: null, p_context: { l1_code: body.l1_code, l4_code: body.l4_code || null, source: 'api_v1_check' } })
            })
            if (lookupRes.ok) {
              const result = await lookupRes.json()
              return json(200, { method: 'check_inference_path()', path: { l1: body.l1_code, l2: body.l2_code, l3: body.l3_code, l4: body.l4_code }, result })
            }
          }
          // 直接用 UUID 呼叫
          const checkRes = await fetch(`${SUPA_URL}/rest/v1/rpc/check_inference_path`, {
            method: 'POST', headers: { ...supaHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_session_id: body.session_id || 'api-' + Date.now(), p_l1_id: l1Id || null, p_l2_id: l2Id || null, p_l3_id: l3Id || null, p_l4_id: l4Id || null, p_context: body.context || {} })
          })
          const result = checkRes.ok ? await checkRes.json() : { error: 'RPC call failed', status: checkRes.status }
          return json(200, { method: 'check_inference_path()', input: { l1_id: l1Id, l2_id: l2Id, l3_id: l3Id, l4_id: l4Id }, result })
        }
        case '/api/v1/inference': {
          const body = await request.json() as any
          if (!body.message) return json(400, { error: 'message is required' })
          const gwRes = await fetch(`${SUPA_URL}/functions/v1/ai-gateway`, {
            method: 'POST', headers: { ...supaHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: body.message, platform: 'api', platform_user_id: body.user_id || 'api-anonymous' })
          })
          const gwData = await gwRes.json()
          return json(gwRes.status, gwData)
        }
        // ── 市集購買 + 自動三級分潤 ──
        case '/api/marketplace/purchase': {
          const body = await request.json() as any
          if (!body.listing_id) return json(400, { error: 'listing_id is required' })
          if (!body.buyer_id && !body.buyer_email) return json(400, { error: 'buyer_id or buyer_email is required' })
          const srvHeaders = { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
          const result = await fetch(`${SUPA_URL}/rest/v1/rpc/marketplace_purchase_with_split`, {
            method: 'POST', headers: srvHeaders,
            body: JSON.stringify({ p_listing_id: body.listing_id, p_buyer_id: body.buyer_id || null, p_buyer_email: body.buyer_email || null, p_referral_code: body.referral_code || null }),
          }).then(r => r.json()).catch(e => ({ success: false, error: String(e) }))
          return json(200, result)
        }
        // ── 市集創作者上架（一鍵上線） ──
        case '/api/marketplace/create': {
          const body = await request.json() as any
          if (!body.title) return json(400, { error: 'title is required' })
          const srvHeaders = { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Prefer': 'return=representation' }
          const listing = {
            title: body.title, subtitle: body.subtitle || '', description: body.description || '',
            price_twd: body.price_twd || 0, pricing_model: body.pricing_model || 'free',
            category: body.category || '', icon: body.icon || '🤖', tags: body.tags || [],
            creator_id: body.creator_id || null, api_endpoint: body.api_endpoint || '',
            status: 'active', featured: false,
          }
          const result = await fetch(`${SUPA_URL}/rest/v1/marketplace_listings`, {
            method: 'POST', headers: srvHeaders, body: JSON.stringify(listing),
          }).then(r => r.json()).catch(e => ({ error: String(e) }))
          return json(201, { success: true, message: '上架成功！你的工具已在市集上線', listing: Array.isArray(result) ? result[0] : result })
        }
        // ── 市集評價 ──
        case '/api/marketplace/review': {
          const body = await request.json() as any
          if (!body.listing_id || !body.rating) return json(400, { error: 'listing_id and rating (1-5) are required' })
          const srvHeaders = { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Prefer': 'return=representation' }
          await fetch(`${SUPA_URL}/rest/v1/marketplace_reviews`, {
            method: 'POST', headers: srvHeaders,
            body: JSON.stringify({ listing_id: body.listing_id, reviewer_id: body.reviewer_id || null, reviewer_name: body.reviewer_name || '匿名', rating: body.rating, comment: body.comment || '' }),
          })
          // 更新商品平均評分
          const reviews = await fetch(`${SUPA_URL}/rest/v1/marketplace_reviews?listing_id=eq.${body.listing_id}&select=rating`, { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }).then(r => r.json()).catch(() => []) as any[]
          if (reviews.length > 0) {
            const avg = (reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(2)
            await fetch(`${SUPA_URL}/rest/v1/marketplace_listings?id=eq.${body.listing_id}`, {
              method: 'PATCH', headers: srvHeaders,
              body: JSON.stringify({ avg_rating: parseFloat(avg), review_count: reviews.length }),
            })
          }
          return json(200, { success: true, message: '評價已送出' })
        }
        default: return json(404, { error: 'Not found' })
      }
    } catch (err: any) {
      console.error('Worker error:', err)
      if (err instanceof SyntaxError) return json(400, { error: 'Invalid JSON body' })
      return json(500, { error: 'Internal error', message: err.message })
    }
  },
}

// ============================================================
// Telegram（按鈕 + AI 腦）
// ============================================================
async function handleTelegram(request: Request, env: Env): Promise<Response> {
  if (env.TELEGRAM_SECRET_TOKEN) {
    const isValid = await verifyTelegram(request, env)
    if (!isValid) return json(401, { error: 'Invalid signature' })
  }

  const body = await request.json() as any
  const botToken = env.TELEGRAM_BOT_TOKEN

  // callback_query：按鈕
  if (body.callback_query) {
    const cb = body.callback_query
    const chatId = String(cb.message?.chat?.id || '')
    const command = cb.data || ''
    const userId = String(cb.from?.id || '')

    if (botToken) await answerCallback(cb.id, botToken)

    if (command === '/start') {
      if (botToken && chatId) await replyTelegram(chatId, mainMenu(), botToken)
      return json(200, { status: 'ok' })
    }

    // 審批按鈕：approve:{queueId} / reject:{queueId}
    if (command.startsWith('approve:') || command.startsWith('reject:')) {
      const [action, queueId] = command.split(':')
      const result = await callApprovalEdge(env, action, {
        queue_id: queueId,
        platform: 'telegram',
        platform_user_id: userId,
      })
      const aiText = await aiFormat(env.AI, `/${action}`, result)
      if (botToken && chatId) {
        await replyTelegram(chatId, { text: aiText, buttons: [[{ text: '📋 待審批', callback_data: '/pending' }, { text: '🏠 主選單', callback_data: '/start' }]] }, botToken)
      }
      // 跨平台通知請求者
      if (result.requester_platform && result.requester_platform_user_id) {
        await notifyRequester(env, result, action)
      }
      return json(200, { status: 'ok' })
    }

    const result = await callEdge(env, command, userId, 'telegram')
    const aiText = await aiFormat(env.AI, command, result)

    if (botToken && chatId) {
      await replyTelegram(chatId, { text: aiText, buttons: quickButtons(command) }, botToken)
    }
    return json(200, { status: 'ok' })
  }

  // 一般訊息
  const msg = normalizeTelegram(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)

  if (parsed.command === '/start' || parsed.command === 'start') {
    if (botToken && msg.chat_id) await replyTelegram(msg.chat_id, mainMenu(), botToken)
    return json(200, { status: 'ok' })
  }

  // 非指令 → AI 約束式對話（經 L1-L4 行業約束閘道）
  if (!parsed.command.startsWith('/')) {
    if (botToken && msg.chat_id) {
      const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'telegram', msg.source_user_id)
      const prefix = result.constrained && !result.allowed ? '⚠️ ' : result.industry ? `🔒 ${result.industry}\n\n` : ''
      await replyTelegram(msg.chat_id, { text: prefix + result.reply, buttons: [[{ text: '🏠 主選單', callback_data: '/start' }]] }, botToken)
    }
    return json(200, { status: 'ok' })
  }

  // 審批閘門：需要老闆核准的指令不直接執行
  const approvalInfo = await checkRequiresApproval(env, parsed.command)
  if (approvalInfo.requires) {
    const queueResult = await callApprovalEdge(env, 'queue', {
      command: parsed.command,
      sub_command: parsed.sub_command,
      args: parsed.args,
      platform: 'telegram',
      platform_user_id: msg.source_user_id,
      request_metadata: { source: 'telegram', source_user_id: msg.source_user_id, session_id: `telegram:${msg.source_user_id}:${Date.now()}` },
    })
    const pendingText = await aiFormat(env.AI, parsed.command, queueResult)
    if (botToken && msg.chat_id) {
      await replyTelegram(msg.chat_id, { text: pendingText, buttons: [[{ text: '🏠 主選單', callback_data: '/start' }]] }, botToken)
    }
    // 通知老闆（含完整解釋）
    await sendApprovalNotification(env, queueResult, approvalInfo)
    return json(200, { status: 'queued_for_approval' })
  }

  // 指令 → SQL + AI 潤稿
  const result = await callEdge(env, parsed.command, msg.source_user_id, 'telegram', parsed.sub_command, parsed.args)
  const aiText = await aiFormat(env.AI, parsed.command, result)

  if (botToken && msg.chat_id) {
    await replyTelegram(msg.chat_id, { text: aiText, buttons: quickButtons(parsed.command) }, botToken)
  }
  return json(200, { status: 'ok', result })
}

// ============================================================
// Discord（Interaction webhook + Gateway relay）
// ============================================================
async function handleDiscord(request: Request, env: Env): Promise<Response> {
  // OS 就緒 — 等待遙控器連入
  if (!env.DISCORD_PUBLIC_KEY) return json(200, { status: 'os_ready', platform: 'discord', message: 'SEOBAIKE OS 就緒，Discord 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/discord' })

  // Ed25519 簽名驗證
  const isValid = await verifyDiscord(request, env)
  if (!isValid) return json(401, { error: 'Invalid signature' })

  const body = await request.json() as any

  // PING（Discord 驗證 endpoint 用，type=1）
  if (body.type === 1) {
    return json(200, { type: 1 })
  }

  // 標準化訊息
  const msg = normalizeDiscord(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)

  // 用戶身份查詢
  const auth = await lookupAuth(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, 'discord', msg.source_user_id)
  console.log(`[AUTH] discord:${msg.source_user_id} → ${auth.permission_level} (bound=${auth.is_bound})`)

  // Interaction 類型（type 2 或 3）需要用 Interaction 回覆
  const isInteraction = body.type === 2 || body.type === 3
  const interactionId = body.id
  const interactionToken = body.token

  // 非指令 → AI 約束式對話
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'discord', msg.source_user_id)
    const prefix = result.constrained && !result.allowed ? '>>> ' : result.industry ? `**${result.industry}**\n\n` : ''
    const replyText = prefix + result.reply

    if (isInteraction) {
      await replyDiscordInteraction(interactionId, interactionToken, replyText)
    } else if (msg.channel_id && env.DISCORD_BOT_TOKEN) {
      await replyDiscordChannel(msg.channel_id, replyText, env.DISCORD_BOT_TOKEN)
    }
    return json(200, { status: 'ok' })
  }

  // 審批閘門
  const approvalInfo = await checkRequiresApproval(env, parsed.command)
  if (approvalInfo.requires) {
    const queueResult = await callApprovalEdge(env, 'queue', {
      command: parsed.command,
      sub_command: parsed.sub_command,
      args: parsed.args,
      platform: 'discord',
      platform_user_id: msg.source_user_id,
      request_metadata: { source: 'discord', source_user_id: msg.source_user_id, session_id: `discord:${msg.source_user_id}:${Date.now()}` },
    })
    const pendingText = await aiFormat(env.AI, parsed.command, queueResult)

    if (isInteraction) {
      await replyDiscordInteraction(interactionId, interactionToken, pendingText)
    } else if (msg.channel_id && env.DISCORD_BOT_TOKEN) {
      await replyDiscordChannel(msg.channel_id, pendingText, env.DISCORD_BOT_TOKEN)
    }
    await sendApprovalNotification(env, queueResult, approvalInfo)
    return json(200, { status: 'queued_for_approval' })
  }

  // 指令 → SQL + AI 潤稿
  const result = await callEdge(env, parsed.command, msg.source_user_id, 'discord', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)

  if (isInteraction) {
    await replyDiscordInteraction(interactionId, interactionToken, replyText)
  } else if (msg.channel_id && env.DISCORD_BOT_TOKEN) {
    await replyDiscordChannel(msg.channel_id, replyText, env.DISCORD_BOT_TOKEN)
  }
  return json(200, { status: 'ok', result })
}

// ============================================================
// Slack（Events API）
// ============================================================
async function handleSlack(request: Request, env: Env): Promise<Response> {
  if (!env.SLACK_SIGNING_SECRET) return json(200, { status: 'os_ready', platform: 'slack', message: 'SEOBAIKE OS 就緒，Slack 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/slack' })

  // HMAC-SHA256 簽名驗證
  const isValid = await verifySlack(request, env)
  if (!isValid) return json(401, { error: 'Invalid signature' })

  const body = await request.json() as any

  // URL 驗證挑戰（Slack 設定 Events API 時的一次性驗證）
  if (body.type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 標準化訊息
  const msg = normalizeSlack(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  const botToken = env.SLACK_BOT_TOKEN
  const channelId = msg.channel_id

  // 用戶身份查詢
  const auth = await lookupAuth(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, 'slack', msg.source_user_id)
  console.log(`[AUTH] slack:${msg.source_user_id} → ${auth.permission_level} (bound=${auth.is_bound})`)

  // 非指令 → AI 約束式對話
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'slack', msg.source_user_id)
    const prefix = result.constrained && !result.allowed ? ':warning: ' : result.industry ? `*${result.industry}*\n\n` : ''
    const replyText = prefix + result.reply

    if (botToken && channelId) {
      await replySlack(channelId, replyText, botToken)
    }
    return json(200, { status: 'ok' })
  }

  // 審批閘門
  const approvalInfo = await checkRequiresApproval(env, parsed.command)
  if (approvalInfo.requires) {
    const queueResult = await callApprovalEdge(env, 'queue', {
      command: parsed.command,
      sub_command: parsed.sub_command,
      args: parsed.args,
      platform: 'slack',
      platform_user_id: msg.source_user_id,
      request_metadata: { source: 'slack', source_user_id: msg.source_user_id, session_id: `slack:${msg.source_user_id}:${Date.now()}` },
    })
    const pendingText = await aiFormat(env.AI, parsed.command, queueResult)

    if (botToken && channelId) {
      await replySlack(channelId, pendingText, botToken)
    }
    await sendApprovalNotification(env, queueResult, approvalInfo)
    return json(200, { status: 'queued_for_approval' })
  }

  // 指令 → SQL + AI 潤稿
  const result = await callEdge(env, parsed.command, msg.source_user_id, 'slack', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)

  if (botToken && channelId) {
    await replySlack(channelId, replyText, botToken)
  }
  return json(200, { status: 'ok', result })
}

// ============================================================
// Microsoft Teams
// ============================================================
async function handleTeamsWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.TEAMS_BOT_TOKEN) return json(200, { status: 'os_ready', platform: 'teams', message: 'SEOBAIKE OS 就緒，Teams 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/teams' })

  const body = await request.json() as any
  const msg = normalizeTeams(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  const serviceUrl = body.serviceUrl || ''
  const conversationId = body.conversation?.id || ''

  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'teams', msg.source_user_id)
    const prefix = result.constrained && !result.allowed ? '> ' : result.industry ? `**${result.industry}**\n\n` : ''
    if (serviceUrl && conversationId) await replyTeams(serviceUrl, conversationId, prefix + result.reply, env.TEAMS_BOT_TOKEN)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'teams', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (serviceUrl && conversationId) await replyTeams(serviceUrl, conversationId, replyText, env.TEAMS_BOT_TOKEN)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Email Webhook
// ============================================================
async function handleEmailWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.EMAIL_API_KEY) return json(200, { status: 'os_ready', platform: 'email', message: 'SEOBAIKE OS 就緒，Email 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/email' })

  const body = await request.json() as any
  const msg = normalizeEmail(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)

  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'email', msg.source_user_id)
    await replyEmail(msg.source_user_id, body.subject || 'SEOBAIKE AI', result.reply, env.EMAIL_API_KEY)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'email', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  await replyEmail(msg.source_user_id, body.subject || 'SEOBAIKE AI', replyText, env.EMAIL_API_KEY)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Google Chat
// ============================================================
async function handleGoogleChatWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CHAT_BOT_TOKEN) return json(200, { status: 'os_ready', platform: 'google_chat', message: 'SEOBAIKE OS 就緒，Google Chat 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/google-chat' })

  const body = await request.json() as any
  const msg = normalizeGoogleChat(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  const spaceName = body.space?.name || ''

  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'google_chat', msg.source_user_id)
    const prefix = result.constrained && !result.allowed ? '> ' : result.industry ? `*${result.industry}*\n\n` : ''
    if (spaceName) await replyGoogleChat(spaceName, prefix + result.reply, env.GOOGLE_CHAT_BOT_TOKEN)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'google_chat', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (spaceName) await replyGoogleChat(spaceName, replyText, env.GOOGLE_CHAT_BOT_TOKEN)
  return json(200, { status: 'ok', result })
}

// ============================================================
// WeChat 微信
// ============================================================
async function handleWechatWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.WECHAT_TOKEN) return json(200, { status: 'os_ready', platform: 'wechat', message: 'SEOBAIKE OS 就緒，WeChat 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/wechat' })

  const body = await request.text()
  const msg = normalizeWechat(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'wechat', msg.source_user_id)
    if (msg.open_id) await replyWechat(msg.open_id, result.reply, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'wechat', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (msg.open_id) await replyWechat(msg.open_id, replyText, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Signal
// ============================================================
async function handleSignalWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.SIGNAL_REST_API_URL) return json(200, { status: 'os_ready', platform: 'signal', message: 'SEOBAIKE OS 就緒，Signal 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/signal' })

  const body = await request.json() as any
  const msg = normalizeSignal(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'signal', msg.source_user_id)
    await replySignal(msg.source_user_id, result.reply, env.SIGNAL_BOT_NUMBER, env.SIGNAL_REST_API_URL)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'signal', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  await replySignal(msg.source_user_id, replyText, env.SIGNAL_BOT_NUMBER, env.SIGNAL_REST_API_URL)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Viber
// ============================================================
async function handleViberWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.VIBER_AUTH_TOKEN) return json(200, { status: 'os_ready', platform: 'viber', message: 'SEOBAIKE OS 就緒，Viber 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/viber' })

  const body = await request.json() as any
  const msg = normalizeViber(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'viber', msg.source_user_id)
    if (msg.viber_user_id) await replyViber(msg.viber_user_id, result.reply, env.VIBER_AUTH_TOKEN)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'viber', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (msg.viber_user_id) await replyViber(msg.viber_user_id, replyText, env.VIBER_AUTH_TOKEN)
  return json(200, { status: 'ok', result })
}

// ============================================================
// SMS (Twilio)
// ============================================================
async function handleSmsWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.TWILIO_AUTH_TOKEN) return json(200, { status: 'os_ready', platform: 'sms', message: 'SEOBAIKE OS 就緒，SMS 遙控器等待連入', webhook: 'https://api.aiforseo.vip/api/webhook/sms' })

  const body = await request.text()
  const msg = normalizeSms(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'sms', msg.source_user_id)
    if (msg.from_number) await replySms(msg.from_number, result.reply, env.TWILIO_PHONE_NUMBER, env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    return json(200, { status: 'ok' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'sms', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  if (msg.from_number) await replySms(msg.from_number, replyText, env.TWILIO_PHONE_NUMBER, env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  return json(200, { status: 'ok', result })
}

// ============================================================
// Web Widget 網頁聊天
// ============================================================
async function handleWebWidgetWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  const msg = normalizeWebWidget(body)
  if (!msg) return json(200, { status: 'ignored' })

  const parsed = parseCommand(msg.text)
  if (!parsed.command.startsWith('/')) {
    const result = await aiConstrainedChat(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, msg.text, 'web_widget', msg.source_user_id)
    // Web Widget 直接回 JSON，不走 callback
    return json(200, { status: 'ok', reply: result.reply, constrained: result.constrained, industry: result.industry })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, 'web_widget', parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  return json(200, { status: 'ok', reply: replyText, result })
}

// ============================================================
// 主選單
// ============================================================
function mainMenu(): TelegramReplyOptions {
  return {
    text: '嗨～想做什麼？點按鈕或直接打字都行。',
    buttons: [
      [{ text: '📊 系統狀態', callback_data: '/status' }, { text: '💰 今日營收', callback_data: '/revenue' }],
      [{ text: '🔍 SEO 分析', callback_data: '/seo' }, { text: '🏷 關鍵字', callback_data: '/keywords' }],
      [{ text: '👤 我的資訊', callback_data: '/me' }, { text: '🎯 點數', callback_data: '/points' }],
      [{ text: '👥 用戶管理', callback_data: '/users' }, { text: '📋 合規查詢', callback_data: '/compliance' }],
      [{ text: '🏭 產業分類', callback_data: '/l1' }, { text: '🔐 綁定帳號', callback_data: '/bind' }],
      [{ text: '📋 待審批', callback_data: '/pending' }, { text: '❓ 幫助', callback_data: '/help' }],
    ],
  }
}

function quickButtons(cmd: string): { text: string, callback_data: string }[][] {
  const h = { text: '🏠 主選單', callback_data: '/start' }
  const s = { text: '📊 狀態', callback_data: '/status' }
  const r = { text: '💰 營收', callback_data: '/revenue' }
  const e = { text: '🔍 SEO', callback_data: '/seo' }
  if (cmd === '/status') return [[r, e], [h]]
  if (cmd === '/revenue') return [[s, e], [h]]
  if (cmd === '/seo' || cmd === '/keywords') return [[s, r], [h]]
  return [[s, r], [h]]
}

// ============================================================
// Edge Function Proxy — 世界級 API 統一代理
// ============================================================
async function proxyEdge(request: Request, env: Env, functionName: string): Promise<Response> {
  const SUPA_URL = env.SUPABASE_URL || 'https://vmyrivxxibqydccurxug.supabase.co'
  const body = await request.text()
  const res = await fetch(`${SUPA_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    body,
  })
  const data = await res.text()
  return new Response(data, { status: res.status, headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json' } })
}

// ============================================================
// Edge Function
// ============================================================
async function callEdge(env: Env, command: string, userId: string, source: string, sub_command?: string | null, args?: any): Promise<any> {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/remote-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ command, userId, metadata: { source, source_user_id: userId, session_id: `${source}:${userId}:${Date.now()}`, sub_command: sub_command || null, args: args || {} } }),
  })
  return res.json()
}

// ============================================================
// 其他平台
// ============================================================
async function handleWebhook(request: Request, env: Env, platform: 'line' | 'whatsapp' | 'messenger'): Promise<Response> {
  // OS 就緒 — 未設定 secret 時回應就緒狀態
  const secrets: Record<string, string | undefined> = { line: env.LINE_CHANNEL_SECRET, whatsapp: env.WHATSAPP_ACCESS_TOKEN, messenger: env.MESSENGER_APP_SECRET }
  if (!secrets[platform]) return json(200, { status: 'os_ready', platform, message: `SEOBAIKE OS 就緒，${platform} 遙控器等待連入`, webhook: `https://api.aiforseo.vip/api/webhook/${platform}` })
  const verifiers = { line: verifyLine, whatsapp: verifyWhatsApp, messenger: verifyMessenger }
  const isValid = await verifiers[platform](request, env)
  if (!isValid) return json(401, { error: 'Invalid signature' })
  const body = await request.json()
  const normalizers = { line: normalizeLine, whatsapp: normalizeWhatsApp, messenger: normalizeMessenger }
  const msg = normalizers[platform](body)
  if (!msg) return json(200, { status: 'ignored' })
  const parsed = parseCommand(msg.text)
  const replyCtx: ReplyContext = { source: platform, reply_token: msg.reply_token, chat_id: msg.chat_id, phone_number: msg.phone_number, sender_id: msg.sender_id }

  // 用戶身份查詢（接上 auth 中介層）
  const auth = await lookupAuth(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, platform, msg.source_user_id)
  console.log(`[AUTH] ${platform}:${msg.source_user_id} → ${auth.permission_level} (bound=${auth.is_bound})`)

  // 審批閘門
  const approvalInfo = await checkRequiresApproval(env, parsed.command)
  if (approvalInfo.requires) {
    const queueResult = await callApprovalEdge(env, 'queue', {
      command: parsed.command,
      sub_command: parsed.sub_command,
      args: parsed.args,
      platform,
      platform_user_id: msg.source_user_id,
      request_metadata: { source: platform, source_user_id: msg.source_user_id, session_id: `${platform}:${msg.source_user_id}:${Date.now()}` },
    })
    const pendingText = await aiFormat(env.AI, parsed.command, queueResult)
    try { await sendReply(env, replyCtx, pendingText) } catch (e) { console.error('Reply failed:', e) }
    await sendApprovalNotification(env, queueResult, approvalInfo)
    return json(200, { status: 'queued_for_approval' })
  }

  const result = await callEdge(env, parsed.command, msg.source_user_id, platform, parsed.sub_command, parsed.args)
  const replyText = await aiFormat(env.AI, parsed.command, result)
  try { await sendReply(env, replyCtx, replyText) } catch (e) { console.error('Reply failed:', e) }
  return json(200, { status: 'ok', result })
}

async function handleGateway(request: Request, env: Env): Promise<Response> {
  // Gateway 認證 — 必須帶 Authorization header
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return json(401, { error: 'Unauthorized' })
  }
  let body: any
  try { body = await request.json() } catch { return json(400, { error: 'Invalid JSON body' }) }
  if (!body.command) return json(400, { error: 'command is required' })
  const result = await callEdge(env, body.command, body.userId || 'anonymous', 'web', body.sub_command, body.args)
  return json(200, result)
}

// ============================================================
// SEOBAIKE AI 約束聊天（L1-L4 行業約束）
// ============================================================
async function handleAiChat(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  const { message, platform, platform_user_id } = body

  if (!message) return json(400, { error: 'message is required' })
  if (!platform_user_id) return json(400, { error: 'platform_user_id is required' })

  const result = await aiConstrainedChat(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    message,
    platform || 'web',
    platform_user_id
  )

  return json(200, result)
}

// ── AI 超級市集 — 全供應商統一聊天引擎 ──
const PROVIDER_CONFIG: Record<string, { base_url: string; env_key: string }> = {
  nvidia:     { base_url: 'https://integrate.api.nvidia.com/v1',                    env_key: 'NVIDIA_API_KEY' },
  openrouter: { base_url: 'https://openrouter.ai/api/v1',                           env_key: 'OPENROUTER_API_KEY' },
  google:     { base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', env_key: 'GOOGLE_AI_KEY' },
  groq:       { base_url: 'https://api.groq.com/openai/v1',                         env_key: 'GROQ_API_KEY' },
  together:   { base_url: 'https://api.together.xyz/v1',                             env_key: 'TOGETHER_API_KEY' },
  fireworks:  { base_url: 'https://api.fireworks.ai/inference/v1',                   env_key: 'FIREWORKS_API_KEY' },
  deepseek:   { base_url: 'https://api.deepseek.com',                               env_key: 'DEEPSEEK_API_KEY' },
  mistral:    { base_url: 'https://api.mistral.ai/v1',                              env_key: 'MISTRAL_API_KEY' },
  perplexity: { base_url: 'https://api.perplexity.ai',                              env_key: 'PERPLEXITY_API_KEY' },
  cohere:     { base_url: 'https://api.cohere.ai/compatibility/v1',                 env_key: 'COHERE_API_KEY' },
}

// 自動偵測模型所屬供應商
function detectProvider(model: string): string {
  if (model.startsWith('@cf/')) return 'cloudflare'
  if (model.startsWith('claude-')) return 'anthropic'
  if (model.startsWith('gemini-')) return 'google'
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'openrouter'
  if (model.startsWith('deepseek-')) return 'deepseek'
  if (model.startsWith('mistral-') || model.startsWith('codestral') || model.startsWith('magistral')) return 'mistral'
  if (model.startsWith('sonar')) return 'perplexity'
  if (model.startsWith('command-')) return 'cohere'
  if (model.includes('/')) return 'nvidia' // namespace/model 格式 = NIM
  return 'openrouter' // 預設走 OpenRouter 大聚合
}

async function handleNimChat(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  const model = body.model || 'meta/llama-3.1-70b-instruct'
  const message = body.message || body.messages
  const providerHint = body.provider
  if (!message) return json(400, {
    error: 'message is required',
    example: { provider: 'nvidia', model: 'meta/llama-3.1-405b-instruct', message: 'Hello' },
    providers: Object.keys(PROVIDER_CONFIG),
  })

  const messages = Array.isArray(message) ? message : [
    { role: 'system', content: 'You are SEOBAIKE AI, a helpful assistant powered by the SEOBAIKE OS platform. Answer in the same language the user writes in.' },
    { role: 'user', content: String(message) },
  ]

  // 決定供應商
  const pid = providerHint || detectProvider(model)

  // ── Cloudflare Workers AI（免費內建）──
  if (pid === 'cloudflare') {
    try {
      const cfModel = model.startsWith('@cf/') ? model : '@cf/meta/llama-3.1-8b-instruct'
      const result = await env.AI.run(cfModel, { messages })
      return json(200, { reply: result.response, model: cfModel, provider: 'cloudflare', source: 'workers-ai', })
    } catch (e: any) { return json(500, { error: e.message, provider: 'cloudflare' }) }
  }

  // ── Anthropic Claude（格式不同）──
  if (pid === 'anthropic') {
    const ANTH_KEY = env.ANTHROPIC_API_KEY
    if (!ANTH_KEY) return json(503, { error: 'Anthropic API key not configured', setup: 'wrangler secret put ANTHROPIC_API_KEY' })
    try {
      const sysMsg = messages.find((m: any) => m.role === 'system')?.content || ''
      const userMsgs = messages.filter((m: any) => m.role !== 'system')
      const anthRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTH_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'claude-sonnet-4-5-20250929', max_tokens: body.max_tokens || 1024, system: sysMsg, messages: userMsgs }),
      })
      const anthData = await anthRes.json() as any
      const reply = anthData.content?.[0]?.text
      if (reply) return json(200, { reply, model: anthData.model, provider: 'anthropic', source: 'anthropic-api', usage: anthData.usage })
      return json(anthRes.status, { error: anthData.error || anthData, provider: 'anthropic', model })
    } catch (e: any) { return json(500, { error: e.message, provider: 'anthropic' }) }
  }

  // ── OpenAI 兼容供應商（9 個）──
  const config = PROVIDER_CONFIG[pid]
  if (!config) return json(400, { error: `Unknown provider: ${pid}`, available: Object.keys(PROVIDER_CONFIG) })

  const apiKey = (env as any)[config.env_key] as string
  if (!apiKey) return json(503, { error: `${pid} API key not configured`, setup: `wrangler secret put ${config.env_key}` })

  try {
    const proxyRes = await fetch(`${config.base_url}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: body.max_tokens || 1024, temperature: body.temperature ?? 0.7, stream: false }),
    })
    const data = await proxyRes.json() as any
    if (data.choices?.[0]?.message?.content) {
      return json(200, {
        reply: data.choices[0].message.content,
        model: data.model || model, provider: pid, source: `${pid}-api`,         usage: data.usage,
      })
    }
    return json(proxyRes.status, { error: data.error || data, provider: pid, model })
  } catch (e: any) {
    return json(500, { error: e.message, provider: pid, model })
  }
}

// ── Widget Chat — 走 Smart Router 拿真正好的回覆 ──
async function handleWidgetChatSmart(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  const { message } = body
  if (!message) return json(400, { error: 'message is required' })

  // 台灣口語直接回應，不送給 AI 模型（避免 safety filter 拒答）
  const msgLower = message.toLowerCase()
  const hasProfanity = ['幹', '媽的', '操', '靠', '你娘', '三小', '王八'].some(w => message.includes(w))
  if (hasProfanity) {
    const casual = ['好啦，有什麼想問的？', '好好好，說吧', '沒事，有什麼問題嗎？'][Math.floor(Math.random()*3)]
    return json(200, { reply: casual, source: 'seobaike-ai', engine: 'preset' })
  }

  // 使用所有已設定的 AI providers，依速度/品質排序
  const systemPrompt = `你是小白，SEOBAIKE 客服。

SEOBAIKE 是台灣 AI SEO 平台。功能：建站、SEO分析、AI配音、AI影片、AI客服機器人。費用：點數制，1點=NT$1，無綁約。網址：aiforseo.vip

規則：
- 只有被問到才說上面的資訊，不要主動介紹
- 最多2句
- 繁體中文，口語
- 用戶問什麼就直接答什麼`
  const providers = [
    { id: 'groq', key: env.GROQ_API_KEY, url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
    { id: 'anthropic', key: env.ANTHROPIC_API_KEY, url: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', isAnthropic: true },
    { id: 'google', key: env.GOOGLE_AI_KEY, url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', model: 'gemini-2.0-flash', isGoogle: true },
    { id: 'deepseek', key: env.DEEPSEEK_API_KEY, url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
    { id: 'together', key: env.TOGETHER_API_KEY, url: 'https://api.together.xyz/v1/chat/completions', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    { id: 'openrouter', key: env.OPENROUTER_API_KEY, url: 'https://openrouter.ai/api/v1/chat/completions', model: 'google/gemini-2.0-flash-001' },
    { id: 'mistral', key: env.MISTRAL_API_KEY, url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-large-latest' },
    { id: 'nvidia', key: env.NVIDIA_API_KEY, url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'meta/llama-3.3-70b-instruct' },
    { id: 'cohere', key: env.COHERE_API_KEY, url: 'https://api.cohere.com/v2/chat', model: 'command-r-plus-08-2024', isCohere: true },
    { id: 'fireworks', key: env.FIREWORKS_API_KEY, url: 'https://api.fireworks.ai/inference/v1/chat/completions', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
    { id: 'perplexity', key: env.PERPLEXITY_API_KEY, url: 'https://api.perplexity.ai/chat/completions', model: 'sonar' },
    { id: 'ai21', key: env.AI21_API_KEY, url: 'https://api.ai21.com/studio/v1/chat/completions', model: 'jamba-1.5-large' },
    { id: 'xai', key: env.XAI_API_KEY, url: 'https://api.x.ai/v1/chat/completions', model: 'grok-2-latest' },
  ]

  for (const p of providers) {
    if (!p.key) continue
    try {
      let res: Response
      // Anthropic format (claude models)
      if ((p as any).isAnthropic) {
        res = await fetch(p.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: p.model, system: systemPrompt, messages: [{ role: 'user', content: message }], max_tokens: 300 }),
        })
        if (!res.ok) continue
        const data = await res.json() as any
        const reply = data.content?.[0]?.text
        if (reply) return json(200, { reply, source: 'seobaike-ai', engine: p.id })
        continue
      }
      // Google Gemini format
      if ((p as any).isGoogle) {
        const googleUrl = `${p.url}?key=${p.key}`
        res = await fetch(googleUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n用戶：${message}` }] }], generationConfig: { maxOutputTokens: 300 } }),
        })
        if (!res.ok) continue
        const data = await res.json() as any
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (reply) return json(200, { reply, source: 'seobaike-ai', engine: p.id })
        continue
      }
      // Cohere v2 format
      if ((p as any).isCohere) {
        res = await fetch(p.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
          body: JSON.stringify({ model: p.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }], max_tokens: 300 }),
        })
        if (!res.ok) continue
        const data = await res.json() as any
        const reply = data.message?.content?.[0]?.text
        if (reply) return json(200, { reply, source: 'seobaike-ai', engine: p.id })
        continue
      }
      // Standard OpenAI-compatible format (groq, deepseek, together, openrouter, mistral, nvidia, fireworks)
      res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
        body: JSON.stringify({ model: p.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }], max_tokens: 300, temperature: 0.7 }),
      })
      if (!res.ok) continue
      const data = await res.json() as any
      const reply = data.choices?.[0]?.message?.content
      if (reply) return json(200, { reply, source: 'seobaike-ai', engine: p.id })
    } catch { continue }
  }

  // 全部失敗才用 Workers AI
  try {
    const reply = await aiChat(env.AI, message)
    if (reply) return json(200, { reply, source: 'seobaike-ai', engine: 'edge' })
  } catch { /* fall through */ }

  // 最終 fallback：根據關鍵字給預設答案
  const m = message
  if (/功能|服務|做什麼|可以做/.test(m)) return json(200, { reply: '我們提供：建站、SEO分析、AI配音、AI影片、AI客服。到 aiforseo.vip 看更多！', source: 'seobaike-ai', engine: 'fallback' })
  if (/價格|費用|多少錢|點數|收費/.test(m)) return json(200, { reply: '點數制，1點=NT$1，無綁約。詳情看 aiforseo.vip/pricing', source: 'seobaike-ai', engine: 'fallback' })
  if (/登入|login|帳號|密碼|註冊/.test(m)) return json(200, { reply: '到 aiforseo.vip/login 登入，支援 Google 快速登入。', source: 'seobaike-ai', engine: 'fallback' })
  return json(200, { reply: '稍等，系統忙碌中，請再說一次！', source: 'seobaike-ai', engine: 'fallback' })
}

// ============================================================
// SEOBAIKE 智能路由器 — L1-L4 專利約束 + 意圖偵測自動選模型
// ============================================================

// 意圖類型定義
type IntentType = 'code' | 'reasoning' | 'search' | 'chat' | 'analysis' | 'chinese' | 'translation' | 'vision' | 'creative'

// 每種意圖的最佳供應商 + 模型 + 降級鏈
const INTENT_ROUTING_TABLE: Record<IntentType, Array<{ provider: string; model: string; reason_zh: string }>> = {
  code: [
    { provider: 'deepseek', model: 'deepseek-coder', reason_zh: '程式碼專精模型' },
    { provider: 'fireworks', model: 'accounts/fireworks/models/deepseek-coder-v2-lite-instruct', reason_zh: '程式碼快速推理' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', reason_zh: '超高速通用推理' },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-4', reason_zh: '頂級程式碼能力' },
    { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct', reason_zh: '免費邊緣降級' },
  ],
  reasoning: [
    { provider: 'deepseek', model: 'deepseek-reasoner', reason_zh: 'DeepSeek R1 推理之王' },
    { provider: 'google', model: 'gemini-2.0-flash-thinking-exp', reason_zh: 'Gemini 思維鏈' },
    { provider: 'openrouter', model: 'openai/o3-mini', reason_zh: 'OpenAI 推理模型' },
    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', reason_zh: 'Claude 深度分析' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', reason_zh: '快速通用降級' },
  ],
  search: [
    { provider: 'perplexity', model: 'sonar-pro', reason_zh: 'Perplexity 搜尋增強 AI' },
    { provider: 'perplexity', model: 'sonar', reason_zh: 'Perplexity 快速搜尋' },
    { provider: 'cohere', model: 'command-r-plus', reason_zh: 'Cohere RAG 企業搜尋' },
    { provider: 'openrouter', model: 'perplexity/sonar-pro', reason_zh: 'OpenRouter 搜尋降級' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', reason_zh: '通用降級（無搜尋）' },
  ],
  chat: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile', reason_zh: 'LPU 超高速聊天' },
    { provider: 'groq', model: 'llama-3.1-8b-instant', reason_zh: 'Groq 極速小模型' },
    { provider: 'together', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', reason_zh: 'Together 快速推理' },
    { provider: 'fireworks', model: 'accounts/fireworks/models/llama-v3p1-70b-instruct', reason_zh: 'Fireworks 快速推理' },
    { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct', reason_zh: '免費邊緣降級' },
  ],
  analysis: [
    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', reason_zh: 'Claude 複雜分析' },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-4', reason_zh: 'OpenRouter Claude 降級' },
    { provider: 'google', model: 'gemini-2.0-flash', reason_zh: 'Gemini 多模態分析' },
    { provider: 'deepseek', model: 'deepseek-chat', reason_zh: 'DeepSeek 通用分析' },
    { provider: 'nvidia', model: 'meta/llama-3.1-405b-instruct', reason_zh: 'NVIDIA 企業級大模型' },
  ],
  chinese: [
    { provider: 'deepseek', model: 'deepseek-chat', reason_zh: '中文最強模型' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat', reason_zh: 'OpenRouter DeepSeek 降級' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', reason_zh: 'Groq 中文通用' },
    { provider: 'google', model: 'gemini-2.0-flash', reason_zh: 'Gemini 多語言' },
    { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct', reason_zh: '免費邊緣降級' },
  ],
  translation: [
    { provider: 'deepseek', model: 'deepseek-chat', reason_zh: '多語言翻譯優選' },
    { provider: 'google', model: 'gemini-2.0-flash', reason_zh: 'Google 翻譯能力' },
    { provider: 'mistral', model: 'mistral-large-latest', reason_zh: 'Mistral 歐洲多語言' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', reason_zh: 'Groq 通用翻譯' },
    { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct', reason_zh: '免費邊緣降級' },
  ],
  vision: [
    { provider: 'google', model: 'gemini-2.0-flash', reason_zh: 'Gemini 視覺分析' },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-4', reason_zh: 'Claude 圖像理解' },
    { provider: 'nvidia', model: 'microsoft/phi-3.5-vision-instruct', reason_zh: 'NVIDIA 視覺模型' },
    { provider: 'together', model: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo', reason_zh: 'Together 視覺降級' },
    { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct', reason_zh: '免費邊緣降級（無視覺）' },
  ],
  creative: [
    { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', reason_zh: 'Claude 創意寫作' },
    { provider: 'openrouter', model: 'anthropic/claude-sonnet-4', reason_zh: 'OpenRouter Claude 降級' },
    { provider: 'mistral', model: 'mistral-large-latest', reason_zh: 'Mistral 創作能力' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile', reason_zh: 'Groq 通用創作' },
    { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct', reason_zh: '免費邊緣降級' },
  ],
}

// 意圖偵測：分析用戶訊息，判斷最佳路由
// Intent detection: analyze user message to determine best routing
function detectIntent(message: string, hints?: { l1?: string; l2?: string; l3?: string; l4?: string }): { intent: IntentType; confidence: number; reason_zh: string } {
  const lower = message.toLowerCase()
  const len = message.length

  // 程式碼意圖關鍵詞
  // Code intent keywords
  const codeKeywords = /\b(code|function|class|import|export|const |let |var |def |async |await |return |console\.|print\(|debug|bug|error|exception|api|endpoint|sql|query|database|html|css|javascript|typescript|python|rust|go |java |react|vue|angular|node|npm|git|docker|deploy|compile|runtime|syntax|algorithm|regex|json|xml|yaml|http|tcp|udp|socket|server|client|backend|frontend|fullstack|devops|ci\/cd|test|unit test|程式|程式碼|寫一個|函數|函式|變數|陣列|迴圈|除錯|部署|編譯|語法)\b/i
  if (codeKeywords.test(message)) {
    return { intent: 'code', confidence: 0.9, reason_zh: '偵測到程式碼相關關鍵詞' }
  }

  // 推理 / 數學 / 邏輯意圖
  // Reasoning / math / logic intent
  const reasoningKeywords = /\b(prove|proof|theorem|calculate|equation|formula|logic|reason|deduce|infer|math|mathematics|algebra|calculus|geometry|statistics|probability|hypothesis|paradox|puzzle|solve|solution|step.by.step|think|思考|推理|邏輯|證明|計算|數學|方程式|公式|統計|機率|解題|步驟)\b/i
  if (reasoningKeywords.test(message)) {
    return { intent: 'reasoning', confidence: 0.85, reason_zh: '偵測到推理/數學/邏輯關鍵詞' }
  }

  // 搜尋 / 時事 / 即時資訊意圖
  // Search / current events / real-time info intent
  const searchKeywords = /\b(search|find|look up|latest|news|today|current|recent|2025|2026|stock|price|weather|what happened|who is|where is|when did|搜尋|查詢|最新|新聞|今天|即時|股價|天氣|查一下|幫我找|現在|目前)\b/i
  if (searchKeywords.test(message)) {
    return { intent: 'search', confidence: 0.85, reason_zh: '偵測到搜尋/即時資訊需求' }
  }

  // 視覺 / 圖片分析意圖
  // Vision / image analysis intent
  const visionKeywords = /\b(image|picture|photo|screenshot|diagram|chart|graph|看圖|圖片|照片|截圖|描述這張|分析這張|看看這)\b/i
  if (visionKeywords.test(message)) {
    return { intent: 'vision', confidence: 0.8, reason_zh: '偵測到視覺/圖片分析需求' }
  }

  // 翻譯意圖
  // Translation intent
  const translationKeywords = /\b(translate|translation|翻譯|翻成|translate.*(to|into)|幫我翻|中翻英|英翻中|日翻中|翻成中文|翻成英文|翻成日文)\b/i
  if (translationKeywords.test(message)) {
    return { intent: 'translation', confidence: 0.9, reason_zh: '偵測到翻譯需求' }
  }

  // 創意寫作意圖
  // Creative writing intent
  const creativeKeywords = /\b(write|story|poem|essay|creative|blog|article|copywriting|script|novel|寫一篇|故事|詩|文章|部落格|劇本|文案|廣告|小說|創作|寫作)\b/i
  if (creativeKeywords.test(message)) {
    return { intent: 'creative', confidence: 0.8, reason_zh: '偵測到創意寫作需求' }
  }

  // 複雜分析意圖（長訊息 或 分析關鍵詞）
  // Complex analysis intent (long messages or analysis keywords)
  const analysisKeywords = /\b(analyze|analysis|compare|evaluate|assess|review|explain|summarize|summary|breakdown|深度分析|比較|評估|摘要|總結|解釋|綜合|報告)\b/i
  if (analysisKeywords.test(message) || len > 500) {
    return { intent: 'analysis', confidence: 0.75, reason_zh: len > 500 ? '訊息過長，使用大模型分析' : '偵測到分析需求' }
  }

  // 中文優先偵測（純中文且無特定意圖）
  // Chinese language detection (pure Chinese with no specific intent)
  const chineseRatio = (message.match(/[\u4e00-\u9fff]/g) || []).length / Math.max(len, 1)
  if (chineseRatio > 0.5) {
    return { intent: 'chinese', confidence: 0.7, reason_zh: '偵測到中文為主的訊息' }
  }

  // L1-L4 約束層提示影響路由
  // L1-L4 constraint layer hints affect routing
  if (hints?.l1 || hints?.l2 || hints?.l3 || hints?.l4) {
    return { intent: 'analysis', confidence: 0.7, reason_zh: '有 L1-L4 約束層提示，使用深度分析' }
  }

  // 預設：一般聊天（走最快的模型）
  // Default: general chat (use fastest model)
  return { intent: 'chat', confidence: 0.6, reason_zh: '一般聊天，使用最快速模型' }
}

// 呼叫指定供應商的 AI 模型
// Call a specific provider's AI model
async function callProviderModel(
  env: Env,
  provider: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  temperature: number,
): Promise<{ ok: boolean; reply?: string; model?: string; usage?: any; error?: string }> {

  // Cloudflare Workers AI（免費內建）
  if (provider === 'cloudflare') {
    try {
      const cfModel = model.startsWith('@cf/') ? model : '@cf/meta/llama-3.1-8b-instruct'
      const result = await env.AI.run(cfModel, { messages, max_tokens: maxTokens })
      return { ok: true, reply: result.response, model: cfModel }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  // Anthropic Claude（自訂格式）
  if (provider === 'anthropic') {
    const key = env.ANTHROPIC_API_KEY
    if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY not configured' }
    try {
      const sysMsg = messages.find(m => m.role === 'system')?.content || ''
      const userMsgs = messages.filter(m => m.role !== 'system')
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sysMsg, messages: userMsgs, temperature }),
      })
      const data = await res.json() as any
      const reply = data.content?.[0]?.text
      if (reply) return { ok: true, reply, model: data.model, usage: data.usage }
      return { ok: false, error: data.error?.message || JSON.stringify(data.error || data) }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  }

  // OpenAI 兼容供應商（PROVIDER_CONFIG 中的所有供應商）
  const config = PROVIDER_CONFIG[provider]
  if (!config) return { ok: false, error: `Unknown provider: ${provider}` }

  const apiKey = (env as any)[config.env_key] as string
  if (!apiKey) return { ok: false, error: `${config.env_key} not configured` }

  try {
    const res = await fetch(`${config.base_url}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream: false }),
    })
    const data = await res.json() as any
    if (data.choices?.[0]?.message?.content) {
      return { ok: true, reply: data.choices[0].message.content, model: data.model || model, usage: data.usage }
    }
    return { ok: false, error: data.error?.message || JSON.stringify(data.error || data) }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

async function handleSmartRouter(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as any
  const { message, l1, l2, l3, l4, max_tokens, temperature, force_provider, force_model } = body

  if (!message) {
    return json(400, {
      error: 'message is required',
            example: {
        message: 'Write a Python function to sort a list',
        l1: 'L1-01',
        l2: 'L2-0101',
        l3: 'L3-010101',
        l4: 'L4-01010101',
        force_provider: 'groq',
        force_model: 'llama-3.3-70b-versatile',
      },
      supported_intents: Object.keys(INTENT_ROUTING_TABLE),
    })
  }

  const t0 = Date.now()

  // L1-L4 約束驗證（如果提供了層級提示）
  // L1-L4 constraint validation (if layer hints provided)
  let constraintResult: any = null
  if (l1 || l2 || l3 || l4) {
    try {
      const SUPA_URL = env.SUPABASE_URL || 'https://vmyrivxxibqydccurxug.supabase.co'
      const checkRes = await fetch(`${SUPA_URL}/rest/v1/rpc/check_inference_path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          p_session_id: `smart-router-${Date.now()}`,
          p_l1_id: null,
          p_l2_id: null,
          p_l3_id: null,
          p_l4_id: null,
          p_context: { l1_code: l1 || null, l2_code: l2 || null, l3_code: l3 || null, l4_code: l4 || null, source: 'smart_router' },
        }),
      })
      if (checkRes.ok) {
        constraintResult = await checkRes.json()
      }
    } catch {
      // 約束驗證失敗不影響路由，繼續
    }
  }

  // 偵測意圖
  // Detect intent
  const intentResult = detectIntent(message, { l1, l2, l3, l4 })

  // 取得路由鏈
  // Get routing chain
  const routingChain = INTENT_ROUTING_TABLE[intentResult.intent]

  // 如果指定了供應商和模型，直接使用
  // If provider and model are forced, use them directly
  if (force_provider && force_model) {
    const systemPrompt = "你是 SEOBAIKE 平台上聰明的 AI 助手。禁止自我介紹、禁止主動推銷價格、禁止客套。像朋友聊天一樣回答，最多 2 句，直接給答案。用戶寫什麼語言就用什麼語言回。"
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: String(message) },
    ]
    const result = await callProviderModel(env, force_provider, force_model, messages, max_tokens || 1024, temperature ?? 0.7)
    return json(result.ok ? 200 : 502, {
            router: 'smart',
      intent: intentResult,
      forced: true,
      provider: force_provider,
      model: result.model || force_model,
      reply: result.reply || null,
      error: result.error || null,
      usage: result.usage || null,
      constraint: constraintResult,
      latency_ms: Date.now() - t0,
    })
  }

  // 依照路由鏈嘗試，失敗自動降級
  // Try routing chain in order, auto-fallback on failure
  const systemPrompt = "你是小百，SEOBAIKE（aiforseo.vip）AI 助手。15 個引擎、1300+ 模型、14 個通訊管道。台灣小路光有限公司開發。規則：繁體中文回覆、最多 3 句、直接給答案、不客套。用戶寫英文就用英文回。"
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: String(message) },
  ]

  const errors: Array<{ provider: string; model: string; error: string }> = []

  for (const route of routingChain) {
    const result = await callProviderModel(
      env,
      route.provider,
      route.model,
      chatMessages,
      max_tokens || 1024,
      temperature ?? 0.7,
    )

    if (result.ok && result.reply) {
      return json(200, {
                router: 'smart',
        intent: intentResult,
        provider: route.provider,
        model: result.model || route.model,
        reason_zh: route.reason_zh,
        reply: result.reply,
        usage: result.usage || null,
        constraint: constraintResult,
        fallback_count: errors.length,
        fallback_errors: errors.length > 0 ? errors : undefined,
        latency_ms: Date.now() - t0,
      })
    }

    // 記錄失敗，繼續嘗試下一個
    // Record failure, try next provider
    errors.push({ provider: route.provider, model: route.model, error: result.error || 'Unknown error' })
  }

  // 所有供應商都失敗
  // All providers failed
  return json(502, {
        router: 'smart',
    intent: intentResult,
    error: '所有供應商都無法回應 / All providers failed',
    errors,
    constraint: constraintResult,
    latency_ms: Date.now() - t0,
  })
}

// ── SEOBAIKE 金流結帳 ──
async function handleStripeCheckout(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) return json(503, { error: '金流系統尚未設定' })

  const body = await request.json() as any
  const plan = body.plan || 'professional'

  const prices: Record<string, { amount: number; name: string }> = {
    professional: { amount: 299000, name: 'SEOBAIKE Professional（NT$2,990/月）' },
    enterprise: { amount: 0, name: 'SEOBAIKE Enterprise（客製報價）' },
  }
  const selected = prices[plan]
  if (!selected || selected.amount === 0) {
    return json(200, { redirect: 'https://aiforseo.vip/contact', message: '企業方案請聯繫業務' })
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'mode': 'subscription',
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': 'twd',
      'line_items[0][price_data][unit_amount]': String(selected.amount),
      'line_items[0][price_data][recurring][interval]': 'month',
      'line_items[0][price_data][product_data][name]': selected.name,
      'line_items[0][quantity]': '1',
      'success_url': 'https://aiforseo.vip/dashboard?payment=success',
      'cancel_url': 'https://aiforseo.vip/pricing?payment=cancelled',
    }).toString(),
  })

  const session = await stripeRes.json() as any
  if (session.error) return json(400, { error: session.error.message })
  return json(200, { checkout_url: session.url, session_id: session.id })
}

// ── SEOBAIKE 金流 Webhook — 接收付款通知 ──
async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text()
  try {
    const event = JSON.parse(body)
    const SUPA_URL = env.SUPABASE_URL || 'https://vmyrivxxibqydccurxug.supabase.co'
    const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      await fetch(`${SUPA_URL}/rest/v1/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          stripe_session_id: session.id,
          customer_email: session.customer_email || session.customer_details?.email,
          amount: session.amount_total,
          currency: session.currency,
          status: 'completed',
          plan: 'professional',
        }),
      })
    }
    return json(200, { received: true })
  } catch {
    return json(400, { error: 'Invalid webhook payload' })
  }
}

// ── SEOBAIKE 信件發送 ──
async function handleSendEmail(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) return json(503, { error: '信件系統尚未設定' })

  const body = await request.json() as any
  const { to, subject, html, text } = body
  if (!to || !subject) return json(400, { error: 'to and subject are required' })

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SEOBAIKE <seobaike@aiforseo.vip>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || subject,
    }),
  })

  const result = await resendRes.json() as any
  if (!resendRes.ok) return json(resendRes.status, { error: result.message || 'Failed to send email', details: result })
  return json(200, { sent: true, id: result.id, message: 'Email 已寄出' })
}

// ============================================================
// 工具
// ============================================================
async function fetchToken(env: Env, platform: string, tokenKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_platform_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'apikey': env.SUPABASE_SERVICE_ROLE_KEY },
      body: JSON.stringify({ p_platform: platform, p_token_key: tokenKey }),
    })
    const parsed = await res.json()
    return parsed || null
  } catch { return null }
}

async function sendReply(env: Env, ctx: ReplyContext, text: string): Promise<void> {
  switch (ctx.source) {
    case 'line': { const token = env.LINE_CHANNEL_ACCESS_TOKEN || await fetchToken(env, 'line', 'channel_access_token'); if (ctx.reply_token && token) await replyLine(ctx.reply_token, text, token); break }
    case 'whatsapp': { const pid = env.WHATSAPP_PHONE_NUMBER_ID || await fetchToken(env, 'whatsapp', 'phone_number_id'); const token = env.WHATSAPP_ACCESS_TOKEN || await fetchToken(env, 'whatsapp', 'access_token'); if (ctx.phone_number && pid && token) await replyWhatsApp(ctx.phone_number, text, pid, token); break }
    case 'messenger': { const token = env.MESSENGER_PAGE_ACCESS_TOKEN || await fetchToken(env, 'messenger', 'page_access_token'); if (ctx.sender_id && token) await replyMessenger(ctx.sender_id, text, token); break }
    case 'discord': { if (ctx.channel_id && env.DISCORD_BOT_TOKEN) await replyDiscordChannel(ctx.channel_id, text, env.DISCORD_BOT_TOKEN); break }
    case 'slack': { if (ctx.channel_id && env.SLACK_BOT_TOKEN) await replySlack(ctx.channel_id, text, env.SLACK_BOT_TOKEN); break }
    case 'teams': { if (ctx.service_url && ctx.chat_id && env.TEAMS_BOT_TOKEN) await replyTeams(ctx.service_url, ctx.chat_id, text, env.TEAMS_BOT_TOKEN); break }
    case 'email': { if (ctx.sender_id && env.EMAIL_API_KEY) await replyEmail(ctx.sender_id, ctx.email_subject || 'SEOBAIKE AI', text, env.EMAIL_API_KEY); break }
    case 'google_chat': { if (ctx.space_name && env.GOOGLE_CHAT_BOT_TOKEN) await replyGoogleChat(ctx.space_name, text, env.GOOGLE_CHAT_BOT_TOKEN); break }
    case 'wechat': { if (ctx.open_id && env.WECHAT_APP_ID) await replyWechat(ctx.open_id, text, env.WECHAT_APP_ID, env.WECHAT_APP_SECRET); break }
    case 'signal': { if (env.SIGNAL_REST_API_URL) await replySignal(ctx.sender_id || '', text, env.SIGNAL_BOT_NUMBER, env.SIGNAL_REST_API_URL); break }
    case 'viber': { if (ctx.viber_user_id && env.VIBER_AUTH_TOKEN) await replyViber(ctx.viber_user_id, text, env.VIBER_AUTH_TOKEN); break }
    case 'sms': { if (ctx.from_number && env.TWILIO_AUTH_TOKEN) await replySms(ctx.from_number, text, env.TWILIO_PHONE_NUMBER, env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN); break }
    case 'web_widget': { if (ctx.callback_url) await replyWebWidget(ctx.callback_url, text, ctx.session_token); break }
  }
}

// ============================================================
// 審批系統
// ============================================================
async function callApprovalEdge(env: Env, action: string, params: Record<string, any>): Promise<any> {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/boss-approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ action, ...params }),
  })
  return res.json()
}

interface ApprovalInfo {
  requires: boolean
  description_zh?: string
  risk_level?: string
  impact_description_zh?: string
}

async function checkRequiresApproval(env: Env, command: string): Promise<ApprovalInfo> {
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/remote_command_templates?command=eq.${encodeURIComponent(command)}&select=requires_confirmation,description_zh,risk_level,impact_description_zh&limit=1`,
      { headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
    )
    const data = await res.json() as any[]
    if (data?.[0]?.requires_confirmation) {
      return {
        requires: true,
        description_zh: data[0].description_zh,
        risk_level: data[0].risk_level,
        impact_description_zh: data[0].impact_description_zh,
      }
    }
    return { requires: false }
  } catch {
    return { requires: false }
  }
}

async function sendApprovalNotification(env: Env, queueResult: any, approvalInfo: ApprovalInfo): Promise<void> {
  if (queueResult.error) return

  const platform = queueResult.approver_platform
  const chatId = queueResult.approver_chat_id
  const code = queueResult.approval_code
  const queueId = queueResult.queue_id

  const riskIcon = queueResult.risk_icon || '🟢 低風險'
  const lines = [
    `📋 審批請求 [${riskIcon}]`,
    '',
    `指令：${queueResult.command}`,
    `說明：${queueResult.description_zh || approvalInfo.description_zh || ''}`,
    `影響：${queueResult.impact_description_zh || approvalInfo.impact_description_zh || '無特殊影響'}`,
  ]

  if (queueResult.sub_command) lines.push(`參數：${queueResult.sub_command} ${JSON.stringify(queueResult.args || {})}`)
  lines.push(`請求者：${queueResult.requester_name || '未知'} (${queueResult.requester_platform || ''})`)
  lines.push(`審批碼：${code}`)
  lines.push(`⏰ ${queueResult.expires_minutes || 30} 分鐘內有效`)

  const text = lines.join('\n')

  if (platform === 'telegram' && chatId && env.TELEGRAM_BOT_TOKEN) {
    await replyTelegram(chatId, {
      text,
      buttons: [
        [
          { text: '✅ 核准', callback_data: `approve:${queueId}` },
          { text: '❌ 拒絕', callback_data: `reject:${queueId}` },
        ],
        [{ text: '📋 所有待審批', callback_data: '/pending' }],
      ],
    }, env.TELEGRAM_BOT_TOKEN)
  } else if (platform === 'line') {
    const lineToken = env.LINE_CHANNEL_ACCESS_TOKEN || await fetchToken(env, 'line', 'channel_access_token')
    if (chatId && lineToken) {
      await pushLine(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, lineToken)
    }
  } else if (platform === 'whatsapp' && chatId) {
    const pid = env.WHATSAPP_PHONE_NUMBER_ID || await fetchToken(env, 'whatsapp', 'phone_number_id')
    const token = env.WHATSAPP_ACCESS_TOKEN || await fetchToken(env, 'whatsapp', 'access_token')
    if (pid && token) {
      const { replyWhatsApp } = await import('./reply/whatsapp-reply')
      await replyWhatsApp(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, pid, token)
    }
  } else if (platform === 'messenger' && chatId) {
    const token = env.MESSENGER_PAGE_ACCESS_TOKEN || await fetchToken(env, 'messenger', 'page_access_token')
    if (token) {
      const { replyMessenger } = await import('./reply/messenger-reply')
      await replyMessenger(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, token)
    }
  } else if (platform === 'discord' && chatId && env.DISCORD_BOT_TOKEN) {
    await replyDiscordChannel(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, env.DISCORD_BOT_TOKEN)
  } else if (platform === 'slack' && chatId && env.SLACK_BOT_TOKEN) {
    await replySlack(chatId, text + `\n\n回覆 /approve ${code} 核准\n回覆 /reject ${code} 拒絕`, env.SLACK_BOT_TOKEN)
  }
}

async function notifyRequester(env: Env, approvalResult: any, action: string): Promise<void> {
  const platform = approvalResult.requester_platform
  const platformUserId = approvalResult.requester_platform_user_id
  if (!platform || !platformUserId) return

  const status = action === 'approve' ? '✅ 已核准' : '❌ 已拒絕'
  const text = [
    status,
    `指令：${approvalResult.command}`,
    approvalResult.result?.message || approvalResult.reason || '',
    '',
    '— SEOBAIKE AI',
  ].join('\n')

  if (platform === 'telegram' && env.TELEGRAM_BOT_TOKEN) {
    await replyTelegram(platformUserId, { text, buttons: [[{ text: '🏠 主選單', callback_data: '/start' }]] }, env.TELEGRAM_BOT_TOKEN)
  } else if (platform === 'line') {
    const lineToken = env.LINE_CHANNEL_ACCESS_TOKEN || await fetchToken(env, 'line', 'channel_access_token')
    if (lineToken) await pushLine(platformUserId, text, lineToken)
  } else if (platform === 'whatsapp') {
    const pid = env.WHATSAPP_PHONE_NUMBER_ID || await fetchToken(env, 'whatsapp', 'phone_number_id')
    const token = env.WHATSAPP_ACCESS_TOKEN || await fetchToken(env, 'whatsapp', 'access_token')
    if (pid && token) {
      const { replyWhatsApp } = await import('./reply/whatsapp-reply')
      await replyWhatsApp(platformUserId, text, pid, token)
    }
  } else if (platform === 'messenger') {
    const token = env.MESSENGER_PAGE_ACCESS_TOKEN || await fetchToken(env, 'messenger', 'page_access_token')
    if (token) {
      const { replyMessenger } = await import('./reply/messenger-reply')
      await replyMessenger(platformUserId, text, token)
    }
  } else if (platform === 'discord' && env.DISCORD_BOT_TOKEN) {
    // Discord: platformUserId 在此情境是 channel_id（審批通知發送到頻道）
    await replyDiscordChannel(platformUserId, text, env.DISCORD_BOT_TOKEN)
  } else if (platform === 'slack' && env.SLACK_BOT_TOKEN) {
    // Slack: 使用 DM 通知請求者
    await pushSlackDM(platformUserId, text, env.SLACK_BOT_TOKEN)
  }
}

// ============================================================
// 合規徽章（Framer 嵌入用，預設開啟）
// ============================================================
async function handleComplianceBadge(env: Env, url: URL): Promise<Response> {
  const format = url.searchParams.get('format') || 'svg'

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_compliance_badge_data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: '{}',
  })
  const data = await res.json() as any

  if (format === 'json') {
    return json(200, data)
  }

  // SVG badge — embeddable via <img> or <iframe> in Framer
  const score = data.score ?? 0
  const grade = data.grade ?? 'N/A'
  const color = data.badge_color ?? '#6b7280'
  const iso = data.iso_42001_score ?? 0

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="40" viewBox="0 0 280 40">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
  </defs>
  <rect width="280" height="40" rx="8" fill="url(#bg)"/>
  <rect x="170" width="110" height="40" rx="8" fill="${color}"/>
  <rect x="170" width="8" height="40" fill="${color}"/>
  <text x="14" y="25" fill="#e0e7ff" font-family="system-ui,sans-serif" font-size="13" font-weight="600">AI Compliance</text>
  <text x="100" y="25" fill="#a5b4fc" font-family="system-ui,sans-serif" font-size="11">ISO 42001</text>
  <text x="225" y="25" fill="#fff" font-family="system-ui,sans-serif" font-size="14" font-weight="700" text-anchor="middle">${score}/100 ${grade}</text>
</svg>`

  return new Response(svg, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

// ============================================================
// 工具
// ============================================================
// ============================================================
// 14 平台登錄表
// ============================================================
const PLATFORM_REGISTRY = {
  service: 'SEOBAIKE CaaS',
  version: '5.0.0',
  company: 'Xiao Lu Guang Ltd.',
  total_platforms: 14,
  platforms: [
    { id: 'telegram', name: 'Telegram', status: 'connected', webhook: '/api/webhook/telegram' },
    { id: 'line', name: 'LINE', status: 'os_ready', webhook: '/api/webhook/line' },
    { id: 'whatsapp', name: 'WhatsApp', status: 'os_ready', webhook: '/api/webhook/whatsapp' },
    { id: 'messenger', name: 'Messenger', status: 'os_ready', webhook: '/api/webhook/messenger' },
    { id: 'discord', name: 'Discord', status: 'os_ready', webhook: '/api/webhook/discord' },
    { id: 'slack', name: 'Slack', status: 'os_ready', webhook: '/api/webhook/slack' },
    { id: 'teams', name: 'Microsoft Teams', status: 'os_ready', webhook: '/api/webhook/teams' },
    { id: 'email', name: 'Email', status: 'os_ready', webhook: '/api/webhook/email' },
    { id: 'google_chat', name: 'Google Chat', status: 'os_ready', webhook: '/api/webhook/google-chat' },
    { id: 'wechat', name: 'WeChat 微信', status: 'os_ready', webhook: '/api/webhook/wechat' },
    { id: 'signal', name: 'Signal', status: 'os_ready', webhook: '/api/webhook/signal' },
    { id: 'viber', name: 'Viber', status: 'os_ready', webhook: '/api/webhook/viber' },
    { id: 'sms', name: 'SMS (Twilio)', status: 'os_ready', webhook: '/api/webhook/sms' },
    { id: 'web_widget', name: 'Web Widget', status: 'os_ready', webhook: '/api/webhook/web-widget' },
  ],
}

// 全站安全標頭 — 針對 HTML 頁面（proxy 到 origin 的回應）
const SITE_SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-XSS-Protection': '1; mode=block',
}

// API 安全標頭 — 針對 JSON API 回應
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://aiforseo.vip',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
}

function json(status: number, data: any): Response {
  return new Response(JSON.stringify(data), { status, headers: SECURITY_HEADERS })
}
