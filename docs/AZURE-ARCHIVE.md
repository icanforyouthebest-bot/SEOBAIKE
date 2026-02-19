# Azure — SEOBAIKE 歸檔

## 帳號資訊
- 個人訂閱 ID：fca96658-74df-4d3e-9212-aade3e98ca1f
- AI Empire 訂閱 ID：c1e1278e-c05c-4d00-a4c9-93fbbea01346
- 登入帳號：icanforyouthebest@gmail.com
- Key Vault：https://seobaike-vault.vault.azure.net
- Resource Group：seobaike-rg
- Region：japaneast

## SEOBAIKE App Registration (Entra ID)
- App 名稱：SEOBAIKE-AI-Platform
- App ID：a5775f43-e106-4fa5-828c-d02c7e24a51a
- Redirect URIs：https://aiforseo.vip/auth/callback

## 已部署 Azure 服務
| 服務 | URL | 狀態 |
|------|-----|------|
| Azure Functions (AI Router) | https://seobaike-ai-router.azurewebsites.net | 部署中 |
| Azure Functions (L1-L4 Pipeline) | https://seobaike-l1l4-pipeline.azurewebsites.net | 部署中 |
| APIM Gateway | https://seobaike-apim.azure-api.net | 部署中 |
| Key Vault | https://seobaike-vault.vault.azure.net | 啟用 |
| App Insights | seobaike-insights | 啟用 |

## Worker Secrets 已設定的 AI Keys
| Key | 用途 | 狀態 |
|-----|------|------|
| ANTHROPIC_API_KEY | Claude (Haiku/Sonnet) | ✅ 已設定 |
| GOOGLE_AI_KEY | Gemini 2.0 Flash | ✅ 已設定 |
| GROQ_API_KEY | LLaMA 3.3 70B (超快) | ✅ 已設定 |
| DEEPSEEK_API_KEY | DeepSeek Chat | ✅ 已設定 |
| TOGETHER_API_KEY | LLaMA 3.3 70B Turbo | ✅ 已設定 |
| OPENROUTER_API_KEY | Gemini/Claude 多模型 | ✅ 已設定 |
| MISTRAL_API_KEY | Mistral Large | ✅ 已設定 |
| NVIDIA_API_KEY | LLaMA 3.3 70B (NVIDIA) | ✅ 已設定 |
| COHERE_API_KEY | Command R+ | ✅ 已設定 |
| FIREWORKS_API_KEY | LLaMA 3.3 70B | ✅ 已設定 |
| PERPLEXITY_API_KEY | Sonar (搜尋增強) | ✅ 已設定 |
| AI21_API_KEY | Jamba 1.5 Large | ✅ 已設定 |
| XAI_API_KEY | Grok 2 (xAI) | ✅ 已設定 |
| HUGGINGFACE_API_KEY | HuggingFace | ✅ 已設定 |
| REPLICATE_API_KEY | Replicate | ✅ 已設定 |

## 待接入 Azure 專屬服務
| 服務 | Key 名稱 | 用途 | 優先級 |
|------|---------|------|--------|
| **Azure OpenAI** | AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY | GPT-4o 主力引擎 | ⭐最高 |
| **Azure Speech** | AZURE_SPEECH_KEY, AZURE_SPEECH_REGION | AI 配音（繁中最強）| ⭐最高 |
| **Bing Search API** | BING_SEARCH_API_KEY | SEO 排名即時查詢 | ⭐最高 |
| **Azure Translator** | AZURE_TRANSLATOR_KEY | 多語言 SEO 內容 | 高 |
| **Azure AI Search** | AZURE_SEARCH_ENDPOINT, AZURE_SEARCH_KEY | 知識庫搜尋 | 高 |

## 下一步：請老闆從 Azure Portal 提供
1. Azure OpenAI → 部署 GPT-4o → 取得 Endpoint + API Key
2. Azure Speech → 取得 Key + Region (建議 eastasia)
3. Bing Search → Azure Marketplace 開通 → 取得 API Key
