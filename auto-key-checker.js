// auto-key-checker.js
// 每天自動檢查所有 API key 有效期，剩餘 < 30 天發 Telegram 通知
require('dotenv').config();

const https = require('https');

const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || process.env.LINE_CHANNEL_ID;

async function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: opts.method || 'GET', headers: opts.headers || {} }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function sendTelegram(msg) {
  if (!TELEGRAM_BOT || !TELEGRAM_CHAT) { console.log('[NOTIFY] Telegram not configured, printing only'); return; }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  });
}

async function checkGitHubToken(token) {
  const r = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'User-Agent': 'AI-Empire' }
  });
  if (r.status === 200) {
    const user = JSON.parse(r.body);
    return { ok: true, detail: `user=${user.login}`, expiry: null, daysLeft: 9999 };
  }
  return { ok: false, detail: `HTTP ${r.status}`, expiry: null, daysLeft: 0 };
}

async function checkNvidiaKey(key, name) {
  const r = await fetch('https://integrate.api.nvidia.com/v1/models', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });
  if (r.status === 200) {
    const d = JSON.parse(r.body);
    return { ok: true, detail: `${d.data?.length || 0} models`, expiry: null, daysLeft: 9999 };
  }
  return { ok: false, detail: `HTTP ${r.status}`, expiry: null, daysLeft: 0 };
}

async function checkGrokKey(key) {
  const r = await fetch('https://api.x.ai/v1/models', {
    headers: { Authorization: `Bearer ${key}` }
  });
  if (r.status === 200) {
    const d = JSON.parse(r.body);
    return { ok: true, detail: `${d.data?.length || 0} models`, expiry: null, daysLeft: 9999 };
  }
  return { ok: false, detail: `HTTP ${r.status}`, expiry: null, daysLeft: 0 };
}

async function checkSupabaseJWT(key) {
  try {
    const parts = key.split('.');
    let p = parts[1];
    p += '='.repeat((4 - p.length % 4) % 4);
    const decoded = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    const expDate = new Date(decoded.exp * 1000);
    const daysLeft = Math.floor((expDate - Date.now()) / 86400000);
    return { ok: daysLeft > 0, detail: `role=${decoded.role}`, expiry: expDate.toISOString().split('T')[0], daysLeft };
  } catch (e) {
    return { ok: false, detail: e.message, expiry: null, daysLeft: 0 };
  }
}

async function checkCloudflare(token, zoneId) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (r.status === 200) {
    const d = JSON.parse(r.body);
    return { ok: d.success, detail: `zone=${d.result?.name} ${d.result?.status}`, expiry: null, daysLeft: 9999 };
  }
  return { ok: false, detail: `HTTP ${r.status}`, expiry: null, daysLeft: 0 };
}

async function main() {
  console.log('='.repeat(60));
  console.log('  AI EMPIRE KEY CHECKER — ' + new Date().toLocaleString('zh-TW', {timeZone:'Asia/Taipei'}));
  console.log('='.repeat(60));

  const checks = [
    { name: 'Supabase Anon JWT', fn: () => checkSupabaseJWT(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY) },
    { name: 'GitHub PAT', fn: () => checkGitHubToken(process.env.GITHUB_PAT || process.env.GITHUB_TOKEN) },
    { name: 'NVIDIA Build', fn: () => checkNvidiaKey(process.env.NVIDIA_API_KEY, 'Build') },
    { name: 'NVIDIA NGC', fn: () => checkNvidiaKey(process.env.NVIDIA_NGC_KEY, 'NGC') },
    { name: 'NVIDIA Azure', fn: () => checkNvidiaKey(process.env.NVIDIA_AZURE_KEY, 'Azure') },
    { name: 'Grok / xAI', fn: () => checkGrokKey(process.env.XAI_API_KEY) },
    { name: 'Cloudflare', fn: () => checkCloudflare(process.env.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_ZONE_ID) },
  ];

  const results = [];
  const warnings = [];
  const failures = [];

  for (const c of checks) {
    try {
      const r = await c.fn();
      const tag = r.ok ? (r.daysLeft < 30 ? 'WARN' : 'OK  ') : 'FAIL';
      const expStr = r.expiry ? ` | 到期:${r.expiry} (${r.daysLeft}天)` : '';
      const line = `  [${tag}] ${c.name.padEnd(20)} | ${r.detail}${expStr}`;
      console.log(line);
      results.push(line);
      if (!r.ok) failures.push(c.name);
      else if (r.daysLeft < 30) warnings.push(`${c.name} 剩 ${r.daysLeft} 天`);
    } catch (e) {
      const line = `  [ERR ] ${c.name.padEnd(20)} | ${e.message}`;
      console.log(line);
      results.push(line);
      failures.push(c.name);
    }
  }

  console.log('='.repeat(60));

  // 發通知
  if (failures.length > 0 || warnings.length > 0) {
    const msg = [
      `🚨 <b>AI EMPIRE KEY 警報</b>`,
      `時間：${new Date().toLocaleString('zh-TW', {timeZone:'Asia/Taipei'})}`,
      '',
      failures.length ? `❌ 失效: ${failures.join(', ')}` : '',
      warnings.length ? `⚠️ 即將到期: ${warnings.join(', ')}` : '',
      '',
      '請立即處理！'
    ].filter(Boolean).join('\n');
    console.log('\n[ALERT] 發送通知...');
    await sendTelegram(msg);
    console.log('[ALERT] 通知已發送');
  } else {
    console.log('\n[OK] 全部正常，無需通知');
  }
}

main().catch(console.error);
