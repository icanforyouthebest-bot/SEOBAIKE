// grok-cli.js - Grok CLI (stateless mode)
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

const SYSTEM = '你是艦隊指揮官的專屬 Grok AI。回應精準、提供可直接執行的 code。';
const MAX_CHARS = 3000;

console.log('Grok CLI 啟動。輸入指令，按 Enter。exit 離開。');
rl.prompt();

rl.on('line', async line => {
  const raw = line.trim();
  if (!raw) return rl.prompt();
  if (raw === 'exit') { rl.close(); return; }

  // 強制截斷
  const input = raw.length > MAX_CHARS ? raw.slice(0, MAX_CHARS) : raw;
  if (raw.length > MAX_CHARS) console.log(`[截斷至 ${MAX_CHARS} 字元]`);

  // 每次都是全新對話，無歷史
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: input }
  ];

  try {
    const res = await client.chat.completions.create({
      model: 'grok-4-latest',
      messages,
      temperature: 0.7,
      max_tokens: 2000
    });
    console.log('\n' + res.choices[0].message.content + '\n');
  } catch (e) {
    console.error('[FAIL]', e.message?.slice(0, 200));
  }
  rl.prompt();
});
