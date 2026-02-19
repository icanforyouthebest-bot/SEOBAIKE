
const fs = require('fs');
const content = fs.readFileSync(0, 'utf8');
fs.writeFileSync('C:/SEOBAIKE/supabase/functions/health-monitor/index.ts', content);
console.log('Written', content.length, 'bytes');
