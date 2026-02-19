// key-monitor-worker.js
// Cron: 每天 UTC 18:00 = CST 02:00 自動盤查所有 key 到期日

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },
  async fetch(request, env) {
    // 手動觸發 GET /check
    const url = new URL(request.url);
    if (url.pathname === '/check') {
      const result = await runCheck(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('AI Empire Key Monitor\nGET /check to run manually', { status: 200 });
  }
};

async function runCheck(env) {
  const SB_URL = 'https://vmyrivxxibqydccurxug.supabase.co';
  const SB_KEY = env.SUPABASE_SERVICE_ROLE || env.SUPABASE_ANON_KEY;
  const h = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

  // Read all keys
  const res = await fetch(`${SB_URL}/rest/v1/api_keys_monitor?select=*&order=expiry_date`, { headers: h });
  if (!res.ok) return { error: `Supabase read failed: ${res.status}` };

  const keys = await res.json();
  const now = new Date();
  const warnings = [];
  const updates = [];

  for (const key of keys) {
    if (!key.expiry_date) continue;
    const expiry = new Date(key.expiry_date);
    const daysLeft = Math.floor((expiry - now) / 86400000);

    updates.push(
      fetch(`${SB_URL}/rest/v1/api_keys_monitor?id=eq.${key.id}`, {
        method: 'PATCH',
        headers: { ...h, Prefer: 'return=minimal' },
        body: JSON.stringify({ remaining_days: daysLeft, last_checked_at: now.toISOString() })
      })
    );

    if (daysLeft <= (key.notify_threshold || 30)) {
      warnings.push({ name: key.key_name, days: daysLeft, expires: key.expiry_date?.split('T')[0] });
    }
  }

  await Promise.all(updates);

  // Send notifications
  if (warnings.length > 0) {
    const lines = warnings.map(w => `⚠️ ${w.name}: ${w.days} 天後到期 (${w.expires})`).join('\n');
    const msg = `🚨 AI EMPIRE KEY 警報\n${new Date().toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}\n\n${lines}\n\n請立即更新！`;

    // Telegram
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: msg })
      });
    }

    // M365 Teams
    if (env.TEAMS_WEBHOOK) {
      await fetch(env.TEAMS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "@type": "MessageCard",
          "themeColor": "FF0000",
          "title": "AI EMPIRE Key 即將到期",
          "text": lines.replace(/\n/g, '<br>')
        })
      });
    }
  }

  return {
    checked: keys.length,
    warnings: warnings.length,
    items: warnings,
    time: now.toISOString()
  };
}
