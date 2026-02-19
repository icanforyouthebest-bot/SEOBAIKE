// grok-cli.js - Grok 永久接管工具
require('dotenv').config();
const OpenAI = require('openai');
const readline = require('readline');

const client = new OpenAI({
  apiKey: process.env.GROK_API_KEY || process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '指揮官 > '
});

console.log('Grok 接管模式已啟動！');
console.log('輸入任何指令、錯誤、需求，按 Enter 執行。輸入 exit 離開。');

const SYSTEM = '你是艦隊指揮官的專屬 Grok AI，專精 Supabase、Cloudflare、GitHub、NVIDIA、E5/AZUREC 自動化。回應精準、提供可直接執行的 code、帶艦娘風格。';
const MAX_HISTORY = 20; // 保留最近 20 輪對話

let messages = [{ role: 'system', content: SYSTEM }];

function trimMessages() {
  // 永遠保留 system，只留最近 MAX_HISTORY 條
  const history = messages.slice(1);
  if (history.length > MAX_HISTORY) {
    messages = [{ role: 'system', content: SYSTEM }, ...history.slice(-MAX_HISTORY)];
    console.log(`[系統] 對話已截斷，保留最近 ${MAX_HISTORY} 條`);
  }
}

rl.prompt();

rl.on('line', async line => {
  const input = line.trim();
  if (input.toLowerCase() === 'exit') {
    console.log('Grok 模式關閉，艦隊待命中...');
    rl.close();
    return;
  }
  if (input.toLowerCase() === 'clear') {
    messages = [{ role: 'system', content: SYSTEM }];
    console.log('[系統] 對話記憶已清除\n');
    return rl.prompt();
  }
  if (!input) return rl.prompt();

  trimMessages();
  messages.push({ role: 'user', content: input });

  try {
    const res = await client.chat.completions.create({
      model: 'grok-4-latest',
      messages,
      temperature: 0.7,
    });
    const reply = res.choices[0].message.content;
    console.log('\nGrok 回覆：\n' + reply + '\n');
    messages.push({ role: 'assistant', content: reply });
  } catch (e) {
    if (e.message && e.message.includes('maximum prompt length')) {
      console.log('[系統] 對話太長，自動清除記憶重試...');
      messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: input }];
      try {
        const res2 = await client.chat.completions.create({ model: 'grok-4-latest', messages, temperature: 0.7 });
        const reply2 = res2.choices[0].message.content;
        console.log('\nGrok 回覆：\n' + reply2 + '\n');
        messages.push({ role: 'assistant', content: reply2 });
      } catch (e2) { console.error('Grok 呼叫失敗：', e2.message); }
    } else {
      console.error('Grok 呼叫失敗：', e.message);
    }
  }
  rl.prompt();
});
