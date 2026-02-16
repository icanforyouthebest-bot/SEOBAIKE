# SEOBAIKE → NVIDIA 整套遷移包

> 創辦人：許竣翔（CEO, 小路光有限公司, 統編 60475510）
> 台灣專利 115100981「世界定義約束法用於AI推理」
> 日期：2026-02-16

---

## 一、專利層 L1-L4（核心資產，不可遺失）

### L1 產業類別（26 筆，21 筆已凍結）

| Code | 中文 | 英文 | TSIC | NAICS | 凍結 |
|------|------|------|------|-------|------|
| L1-01 | 農林漁牧業 | Agriculture, Forestry & Fishing | A | 11 | YES |
| L1-02 | 礦業及土石採取業 | Mining & Quarrying | B | 21 | YES |
| L1-03 | 製造業 | Manufacturing | C | 31-33 | YES |
| L1-04 | 電力及燃氣供應業 | Electricity, Gas & Steam Supply | D | 22 | YES |
| L1-05 | 用水供應及污染整治業 | Water Supply, Sewerage & Waste | E | 22 | YES |
| L1-06 | 營建工程業 | Construction | F | 23 | YES |
| L1-07 | 批發及零售業 | Wholesale & Retail Trade | G | 42-45 | YES |
| L1-08 | 運輸及倉儲業 | Transportation & Storage | H | 48-49 | YES |
| L1-09 | 住宿及餐飲業 | Accommodation & Food Service | I | 72 | YES |
| L1-10 | 出版影音及資通訊業 | Information & Communication | J | 51 | YES |
| L1-11 | 金融及保險業 | Financial & Insurance Activities | K | 52 | YES |
| L1-12 | 不動產業 | Real Estate Activities | L | 53 | YES |
| L1-13 | 專業科學及技術服務業 | Professional, Scientific & Technical | M | 54 | YES |
| L1-14 | 支援服務業 | Administrative & Support Services | N | 56 | YES |
| L1-15 | 公共行政及國防 | Public Administration & Defence | O | 92 | YES |
| L1-16 | 教育業 | Education | P | 61 | YES |
| L1-17 | 醫療保健及社會工作 | Human Health & Social Work | Q | 62 | YES |
| L1-18 | 藝術娛樂及休閒服務業 | Arts, Entertainment & Recreation | R | 71 | YES |
| L1-19 | 其他服務業 | Other Service Activities | S | 81 | YES |
| L1-20 | 人工智慧及數位平台業 | AI & Digital Platform Services | J63 | 5112 | YES |
| L1-21 | 能源轉型及永續產業 | Energy Transition & Sustainability | D35 | 2211 | YES |
| EDUCATION | 教育培訓 | Education & Training | - | - | NO |
| FOOD | 餐飲服務 | Food & Beverage | - | - | NO |
| HEALTH | 醫療健康 | Healthcare | - | - | NO |
| REALESTATE | 房地產 | Real Estate | - | - | NO |
| RETAIL | 零售電商 | Retail & E-commerce | - | - | NO |

### 資料量統計
- L1: 26 筆
- L2: 100 筆
- L3: 226 筆
- L4: 414 筆
- 凍結快照: 1 筆
- 全球平台註冊: 91 筆

---

## 二、AI 供應商部隊（19 個）

| ID | 名稱 | API 端點 | 模型數 | 格式 |
|----|------|----------|--------|------|
| nvidia | NVIDIA NIM | integrate.api.nvidia.com/v1 | 185 | openai |
| groq | Groq | api.groq.com/openai/v1 | - | openai |
| anthropic | Anthropic | api.anthropic.com/v1 | - | openai |
| mistral | Mistral AI | api.mistral.ai/v1 | - | openai |
| together | Together AI | api.together.xyz/v1 | - | openai |
| fireworks | Fireworks AI | api.fireworks.ai/inference/v1 | - | openai |
| cohere | Cohere | api.cohere.ai/compatibility/v1 | - | openai |
| xai | xAI (Grok) | api.x.ai/v1 | - | openai |
| openrouter | OpenRouter | openrouter.ai/api/v1 | - | openai |
| deepseek | DeepSeek | api.deepseek.com | - | openai |
| google | Google Gemini | generativelanguage.googleapis.com | - | openai |
| perplexity | Perplexity | api.perplexity.ai | - | openai |
| ai21 | AI21 Labs | api.ai21.com/studio/v1 | - | openai |
| qwen | Alibaba Qwen | dashscope-intl.aliyuncs.com | - | openai |
| huggingface | Hugging Face | api-inference.huggingface.co | - | openai |
| replicate | Replicate | api.replicate.com/v1 | - | openai |
| cloudflare | Workers AI | workers-ai-built-in | - | openai |
| lovable | Lovable AI Gateway | ai.gateway.lovable.dev/v1 | - | openai |
| azure_openai | Azure OpenAI | seobike-ai.openai.azure.com | - | openai |

---

## 三、API Keys（21 組）

| Key 名稱 | 用途 |
|----------|------|
| ngc_api_key | NVIDIA NGC / NIM |
| anthropic_api_key | Anthropic Claude |
| openai_api_key | OpenAI |
| opus_api_key | Opus |
| groq_api_key | Groq |
| mistral_api_key | Mistral AI |
| together_api_key | Together AI |
| fireworks_api_key | Fireworks AI |
| cohere_api_key | Cohere |
| grok_api_key | xAI Grok |
| openrouter_api_key | OpenRouter |
| deepseek_api_key | DeepSeek |
| google_ai_key | Google Gemini |
| perplexity_api_key | Perplexity |
| ai21_api_key | AI21 Labs |
| dashscope_api_key | Alibaba Qwen |
| huggingface_api_key | Hugging Face |
| replicate_api_key | Replicate |
| azure_openai_endpoint | Azure OpenAI |
| telegram_bot_token | Telegram Bot |
| resend_api_key | Resend Email |

---

## 四、基礎設施

| 項目 | 值 |
|------|-----|
| Supabase Project | vmyrivxxibqydccurxug（東京） |
| Supabase Access Token | sbp_f94f9f6246d9059763758ba23b7816929a0607ec |
| Cloudflare Workers | aiforseo.vip |
| GitHub Repo | icanforyouthebest-bot/SEOBAIKE |
| GitHub PAT | github_pat_11B4KTXHQ032i6iLcpaQvQ_... |
| Docker Container | baike-monitor (port 3000) |
| Telegram Bot | @Black_notify_bot → chat 5372713163 |
| 資料庫總表數 | 324 tables |
| 資料庫大小 | 171 MB |
| Edge Functions | 191 個（全部 ACTIVE） |
| Cron Jobs | 14 個（全部 ACTIVE） |

---

## 五、Cron 排程（14 個）

| Job ID | 名稱 | 排程 |
|--------|------|------|
| 11 | worker-heartbeat | 每分鐘 |
| 13 | worker-security-monitor | 每 5 分鐘 |
| 14 | worker-anomaly-detector | 每 5 分鐘 |
| 15 | worker-check-expirations | 每小時 |
| 16 | worker-low-balance | 每 30 分鐘 |
| 17 | worker-qa-check | 每 10 分鐘 |
| 18 | worker-competitor | 每小時 |
| 19 | worker-daily-seo | 每天 08:00 UTC |
| 20 | worker-visitor-report | 每天 00:00 UTC |
| 23 | worker-inference-audit | 每分鐘 |
| 24 | boss-hourly-health | 每小時 |
| 25 | boss-daily-report | 每天 01:00 UTC |
| 28 | worker-ai-health-check | 每 30 分鐘 |
| 30 | worker-audit-logger | 每分鐘 |

---

## 六、系統元件（13 個 healthy）

database, database-tokyo, auth, edge-functions, workers-api, ai-gateway, cron-heartbeat, boss-notify, inference-audit, security-monitor, nvidia-boss, team-orchestrator, edge_functions

---

## 七、NVIDIA 遷移路徑

### 現有 NVIDIA 資源
- NGC API Key: `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`
- NIM Endpoint: `https://integrate.api.nvidia.com/v1`
- 可用模型: 185 個
- API 格式: OpenAI 相容

### 遷移對照
| 現有 | NVIDIA 對應 |
|------|------------|
| Supabase DB | NVIDIA DGX Cloud / Nemo Datastore |
| Cloudflare Workers | NVIDIA NIM Microservices |
| Edge Functions (191) | NVIDIA NIM API Endpoints |
| AI Gateway | NVIDIA NIM Router (統一入口) |
| Cron Jobs | NVIDIA Fleet Command 排程 |
| 監控系統 | NVIDIA Base Command 監控 |
| L1-L4 專利層 | NVIDIA NeMo Guardrails |

---

## 八、本地檔案清單

所有檔案已存在：
- GitHub: `icanforyouthebest-bot/SEOBAIKE` (master branch, commit 9b856fb)
- 本地: `C:\SEOBAIKE\`
- 包含: System_Architecture_2.0/, pages-site/, workers/, py_backup/, handover/

---

> 小路光有限公司 版權所有
> 專利 115100981 保護
