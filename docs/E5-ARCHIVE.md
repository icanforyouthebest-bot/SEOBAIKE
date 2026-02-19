# Microsoft 365 E5 — SEOBAIKE 歸檔

## 帳號資訊
- 組織：AI Empire
- 網域：AIEmpire.onmicrosoft.com
- 管理員：HsuChunHsiang@AIEmpire.onmicrosoft.com
- Tenant ID：c1e1278e-c05c-4d00-a4c9-93fbbea01346
- App (E5-Automation) Client ID：9dc16b16-952d-4190-b626-692c26f9262e

## E5 授權包含 — 對應 SEOBAIKE 功能

| E5 服務 | 用在 SEOBAIKE 哪裡 | 狀態 |
|---------|------------------|------|
| **Azure Active Directory P2** | 員工/客戶 SSO 登入 | 可接入 |
| **Microsoft Teams** | 小白機器人進 Teams 通知老闆 | 待接 |
| **Power Automate** | SEO 報告自動寄送、客戶通知 | 待用 |
| **Power BI** | 客戶 SEO 成效儀表板 | 待接 Supabase |
| **SharePoint** | 客戶文件/知識庫管理 | 待建 |
| **Exchange Online** | 客戶通知 email、系統警報 | 待接 |
| **Microsoft Defender** | 平台資安合規（台灣企業信任）| 啟用中 |
| **Intune** | 裝置管理 | 啟用中 |
| **Copilot for M365** | 內部 AI 助理 | 待評估 |
| **Windows 365** | 遠端工作環境 | 設定中 |

## 自動化腳本
| 腳本 | 功能 | 執行頻率 |
|------|------|---------|
| e5_renewal.py | E5 訂閱保活 (Graph API) | 每3天 |
| org_setup.py | AI Empire 組織完整部署 | 每天 |
| copilot_studio.py | Copilot Studio 設定 | 手動 |
| avd_setup.py | Azure Virtual Desktop | 手動 |
| windows365.py | Cloud PC 管理 | 手動 |

## GitHub Actions
- Repo：https://github.com/icanforyouthebest-bot/e5-automation
- Workflows：E5 Azure Automation、AI Empire Org Full Setup、Windows 365

## 下一步行動
1. Power BI 接 Supabase → 客戶成效儀表板
2. Teams Bot → 小白進 Teams，老闆即時收報告
3. Power Automate → SEO 報告每週自動寄客戶
4. Exchange Online → 系統通知 email 整合
