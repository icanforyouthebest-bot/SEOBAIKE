# SEOBAIKE AI Empire — 當前狀態
更新時間：2026-02-20

## 已完成項目

| 項目 | 狀態 | 備註 |
|---|---|---|
| Service Principal | ✅ | appId: 126182e4, tenant: daea71db |
| Azure RBAC | ✅ | Reader(sub) + Contributor(seobaike-rg) |
| GitHub Secrets | ✅ | 42 個 secrets 已設定 |
| Cloudflare Worker | ✅ | wrangler-ci.toml (無 KV binding) |
| CI Deploy Pipeline | ✅ | 6/6 jobs 全綠 |
| CI Security Gate | ✅ | 3/3 jobs 全綠 |
| Azure Blob 歸檔 | ✅ | seobaikestorage/seobaike-full |
| Supabase 接入 | ✅ | 22 AI API keys 已匯入 |

## 待辦事項

| 項目 | 狀態 | 做法 |
|---|---|---|
| E5 OneDrive 佈建 | ⏳ | 用 HsuChunHsiang@AIEmpire.onmicrosoft.com 登入 portal.office.com 點 OneDrive |

## 關鍵資訊

- Azure Subscription: fca96658-74df-4d3e-9212-aade3e98ca1f
- Azure Tenant (billing): daea71db-b115-4dea-8b51-1b0757fee4b9
- E5 Tenant: c1e1278e-c05c-4d00-a4c9-93fbbea01346
- SP appId: 126182e4-4670-4314-b0ed-21f34d677f97
- Resource Group: seobaike-rg (japaneast)
- Storage Account: seobaikestorage
- GitHub Repo: icanforyouthebest-bot/SEOBAIKE

## 服務端點

- Cloudflare Worker: seobaike-remote-control.workers.dev
- Azure Functions L1L4: seobaike-l1l4-pipeline.azurewebsites.net
- Azure Functions AI Router: seobaike-ai-router.azurewebsites.net
- APIM: seobaike-apim.azure-api.net
- 主網域: aiforseo.vip
- Supabase: tjpamxtqfzztqnrbfkzn.supabase.co

## Azure Blob 歸檔路徑

- ZIP: https://seobaikestorage.blob.core.windows.net/seobaike-full/seobaike-full-20260220-075021.zip
- Manifest: https://seobaikestorage.blob.core.windows.net/seobaike-full/seobaike-manifest-20260220-075021.json
