# 部署記錄

## Cloudflare Workers

| 項目 | 值 |
|------|-----|
| Worker 名稱 | seobaike-remote-control |
| 域名 | aiforseo.vip, www.aiforseo.vip |
| 原始碼 | workers/src/index.ts（50,331 bytes） |
| 最後部署 | 2026-02-15 |
| 部署方式 | `cd workers && npx wrangler deploy` |
| Version ID | 8ba6f489-a5be-4cf1-aacc-fde73646baf1 |

## Cloudflare Pages

| 項目 | 值 |
|------|-----|
| Pages 專案 | seobaike-site |
| 域名 | seobaike-site.pages.dev |
| 用途 | Workers 將非 /api/ 路徑代理到此 |
| 實際狀態 | Framer SPA，所有路由返回相同首頁 HTML |

## Supabase Edge Functions

| 項目 | 值 |
|------|-----|
| 總數 | 160 個 |
| 部署方式 | Supabase MCP 或 `supabase functions deploy` |
| 活躍函數 | nvidia-boss (v7), ai-gateway (v6) |

## GitHub

| 項目 | 值 |
|------|-----|
| 倉庫 | icanforyouthebest-bot/SEOBAIKE |
| 主分支 | master (HEAD: d48801f) |
| PR #1 | data-complete（已合併） |
| PR #2 | global-launch（已合併） |

## Git 提交歷史

```
d48801f 修復 /dashboard 404：新增總部儀表板路由
2b57a35 Merge pull request #2 from global-launch
885faf8 全球上線交付包 — 安全修復 + 五部門文件 + 多語公告
214848f Merge pull request #1 from data-complete
3df3145 第六條：總部各部門專屬資料包
06a24f3 第四條：L5-L10 任務鏈卡點解決文件 / 第五條：十大缺點自評報告
73653c0 release: 十層任務鏈完整成果 v2.0
fa6e630 feat: 十層任務鏈 Layer 1-4 + 7 + 9 完成
bcd0f9d Supabase Edge Function 部署：生態系統儀表板 + AI Widget
cee39e3 Framer 前端串接：AI Widget + 生態系統導航
```
