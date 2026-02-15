# SEOBAIKE 系統使用指南

**日期**：2026-02-15 | **專利**：TW-115100981 | **公司**：小路光有限公司

---

## 一、系統簡介

SEOBAIKE = AI 界的 App Store。基於專利 TW-115100981（世界定義約束法用於 AI 推理），提供插拔式 AI 服務平台。

## 二、核心功能

### 2.1 AI 約束推理
所有 AI 推理必須通過 L1→L2→L3→L4 約束路徑驗證。
- L1：宏觀產業類別（26 個）
- L2：次產業分類（100 個）
- L3：製程類型（226 個）
- L4：原子級節點（414 個）

### 2.2 多平台訊息處理
支援 14 個訊息平台的統一收發。使用者可透過任一平台與 SEOBAIKE AI 互動。

### 2.3 平台目錄
已收錄 4,000 筆 AI/SaaS 平台，涵蓋 2,760 個供應商。

## 三、營運日常操作

### 3.1 系統健康檢查

```bash
# 檢查 API 狀態
curl https://aiforseo.vip/health

# 檢查資料庫連線
# 登入 Supabase Dashboard → Project: vmyrivxxibqydccurxug
```

### 3.2 安全檢測

```bash
cd /path/to/SEOBAIKE
python self_audit.py
# 產出報告：tasks/security_audit_report.json
```

### 3.3 資料庫查詢

```sql
-- 平台統計
SELECT COUNT(*), COUNT(DISTINCT provider) FROM ai_model_registry;

-- 推理稽核軌跡
SELECT COUNT(*) FROM inference_audit_trail;

-- 合規狀態
SELECT framework, COUNT(*) FROM ai_compliance_findings GROUP BY framework;
```

## 四、常見問題

| 問題 | 解決方式 |
|------|---------|
| API 回應 timeout | Supabase 有 4-5 秒限制，避免單次大量查詢 |
| 安全分數低 | 執行 self_audit.py 查看詳細漏洞並修復 |
| 平台 webhook 無回應 | 確認各平台 API 金鑰已設為環境變數 |

## 五、聯絡方式

- CEO：許竣翔
- 公司：小路光有限公司（統編 60475510）
- 網域：aiforseo.vip

---

*SEOBAIKE — 專利 TW-115100981 | 小路光有限公司*
