# 平台對接說明

**日期**：2026-02-15 | **專利**：TW-115100981 | **公司**：小路光有限公司

---

## 一、架構概覽

```
使用者 → 14 訊息平台 → Cloudflare Workers (aiforseo.vip) → Supabase（東京）
                              ↓
                        AI 推理引擎
                              ↓
                   L1→L2→L3→L4 約束驗證
```

## 二、支援的訊息平台（14 個）

| # | 平台 | Webhook 端點 | 狀態 |
|---|------|-------------|------|
| 1 | Telegram | /webhook/telegram | 已設定 |
| 2 | LINE | /webhook/line | 已設定 |
| 3 | WhatsApp | /webhook/whatsapp | 已設定 |
| 4 | Messenger | /webhook/messenger | 已設定 |
| 5 | Discord | /webhook/discord | 已設定 |
| 6 | Slack | /webhook/slack | 已設定 |
| 7 | WeChat | /webhook/wechat | 已設定 |
| 8 | Signal | /webhook/signal | 已設定 |
| 9 | Viber | /webhook/viber | 已設定 |
| 10 | KakaoTalk | /webhook/kakaotalk | 已設定 |
| 11 | Zalo | /webhook/zalo | 已設定 |
| 12 | iMessage | /webhook/imessage | 已設定 |
| 13 | Teams | /webhook/teams | 已設定 |
| 14 | Email | /webhook/email | 已設定 |

## 三、API 端點

| 端點 | 方法 | 用途 |
|------|------|------|
| `https://aiforseo.vip/` | GET | 首頁 |
| `https://aiforseo.vip/health` | GET | 健康檢查 |
| `https://aiforseo.vip/gateway` | POST | AI 推理閘道 |
| `https://aiforseo.vip/webhook/:platform` | POST | 訊息平台 webhook |

## 四、認證方式

### Gateway API
- Bearer Token 認證
- Header: `Authorization: Bearer <token>`
- Token 來源：Supabase `approved_keys` 表

### Webhook
- 各平台各自的簽章驗證
- Telegram: Bot Token 驗證
- LINE: Channel Secret HMAC-SHA256

## 五、新平台對接步驟

1. 在 Supabase `platform_connectors` 表新增連接器記錄
2. 在 workers/src/index.ts 新增 webhook handler
3. 設定平台方 webhook URL 指向 `https://aiforseo.vip/webhook/<platform>`
4. 在平台方取得 API 金鑰/Bot Token
5. 將金鑰設為 Cloudflare Workers 環境變數
6. 測試訊息收發

## 六、誠實揭露

- 14 個訊息平台的 webhook 路由已在程式碼中定義
- 實際啟用的平台需要各平台的 API 金鑰才能運作
- 目前並非所有 14 個平台都已完成實際對接測試

---

*SEOBAIKE — 專利 TW-115100981 | 小路光有限公司*
