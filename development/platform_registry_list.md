# 平台收錄清單

**日期**：2026-02-15 | **專利**：TW-115100981 | **公司**：小路光有限公司

---

## 一、統計總覽

| 指標 | 數值 |
|------|------|
| 總收錄數 | 4,000 筆 |
| 不重複供應商 | 2,760 個 |
| 收錄期間 | 2026-02-13 ~ 2026-02-15 |
| 掃描波次 | 154 波 |
| 產業垂直 | 150+ 個 |

## 二、Tier 分佈

| Tier | 數量 | 佔比 | 說明 |
|------|------|------|------|
| enterprise | 2,319 | 58.0% | 企業級 SaaS/AI 服務 |
| platform | 817 | 20.4% | 平台型服務 |
| standard | 758 | 19.0% | 標準服務 |
| flagship | 78 | 2.0% | 旗艦 AI 模型 |
| edge | 9 | 0.2% | 邊緣運算 |
| infra | 8 | 0.2% | 基礎設施 |
| fast | 7 | 0.2% | 快速推理模型 |
| safety | 4 | 0.1% | 安全模型 |

## 三、前 30 大供應商

| 排名 | 供應商 | 收錄數 |
|------|--------|--------|
| 1 | Google | 34 |
| 2 | Microsoft | 24 |
| 3 | Amazon | 19 |
| 4 | analytics | 18 |
| 5 | nvidia / NVIDIA | 31 |
| 6 | hrtech | 17 |
| 7 | logistics | 17 |
| 8 | blockchain | 16 |
| 9 | edtech | 16 |
| 10 | cybersecurity | 15 |
| 11 | legaltech | 15 |
| 12 | iot | 14 |
| 13 | fintech | 13 |
| 14 | healthtech | 12 |
| 15 | proptech | 12 |
| 16 | govtech | 12 |
| 17 | insurtech | 12 |
| 18 | energy | 12 |
| 19 | cloud | 11 |
| 20 | gamedev | 11 |
| 21 | communication | 11 |
| 22 | enterprise | 11 |
| 23 | api_mgmt | 11 |
| 24 | asia_pacific | 10 |
| 25 | Meta | 10 |
| 26 | mcp | 10 |
| 27 | framework | 10 |
| 28 | openai | 9 |
| 29 | quantum | 9 |
| 30 | Siemens | 8 |

## 四、產業垂直覆蓋

analytics, hrtech, logistics, blockchain, edtech, cybersecurity, legaltech, iot, fintech, healthtech, proptech, govtech, insurtech, energy, cloud, gamedev, communication, enterprise, api_mgmt, asia_pacific, quantum, ecommerce, autonomous, database, defense, payment, devops, ai_coding, biotech, agritech, manufacturing, smartcity, rpa, wearable, education, telecom_5g, contech, maritime, cms, hospitality, igaming, entertainment, robotics, identity, nonprofit, foodtech, retail, mapping, climate, media, drone, notification, spacetech, satellite, weather, childcare, esign, telecom, additive_mfg...

## 五、重要提醒

- 所有 4,000 筆記錄為 SQL INSERT 收錄，**非實際帳號註冊**
- 未取得各平台 API 金鑰，未進行 API 連接測試
- 資料基於公開搜索結果整理

## 六、查詢方式

```sql
-- 完整清單
SELECT model_id, display_name, provider, tier, is_available, created_at
FROM ai_model_registry
ORDER BY provider, display_name;

-- 依供應商分組
SELECT provider, COUNT(*) as cnt
FROM ai_model_registry
GROUP BY provider ORDER BY cnt DESC;

-- 依 tier 統計
SELECT tier, COUNT(*) FROM ai_model_registry GROUP BY tier;
```

---

*SEOBAIKE — 專利 TW-115100981 | 小路光有限公司*
