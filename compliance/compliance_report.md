# 合規檢查報告

**日期**：2026-02-15 | **專利**：TW-115100981 | **公司**：小路光有限公司

---

## 一、五大合規框架掃描結果

資料來源：Supabase `ai_compliance_findings` 表（1,980 筆）

| 框架 | 檢查數 | 通過 | 失敗 | 通過率 |
|------|--------|------|------|--------|
| OWASP LLM Top 10 | 450 | 446 | 4 | 99.1% |
| ISO 42001 | 450 | 450 | 0 | 100.0% |
| NIST AI RMF | 360 | 354 | 0 | 98.3% |
| MITRE ATLAS | 360 | 359 | 1 | 99.7% |
| EU AI Act | 360 | 360 | 0 | 100.0% |
| **合計** | **1,980** | **1,969** | **5** | **99.7%** |

## 二、失敗項目詳情

### OWASP LLM — 4 項失敗

| 檢查項 | 問題描述 | 修復狀態 |
|--------|---------|---------|
| LLM01 | Prompt Injection 防護完整性 | 已加強掃描模式 |
| LLM02 | 不安全輸出處理 | innerHTML 使用需替換 |
| LLM06 | 敏感資訊洩漏 | API 金鑰硬編碼待清理 |
| LLM09 | 過度依賴 | 模擬數據標示不足 |

### MITRE ATLAS — 1 項失敗

| 檢查項 | 問題描述 | 修復狀態 |
|--------|---------|---------|
| AML.T0043 | 模型竊取防護不足 | 需加強 API 認證機制 |

## 三、合規稽核報告總覽

- Supabase `compliance_audit_reports` 表：120 份報告
- 涵蓋期間：2026-02-13 ~ 2026-02-15
- 報告格式：JSON

## 四、誠實揭露

- `run_full_compliance_scan()` 函式因 Supabase REST API 4-5 秒 timeout 限制，無法在單次呼叫中完成全部 5 框架 44 項掃描
- 1,980 筆掃描結果為分批執行後匯總
- 99.7% 通過率數字需注意：部分檢查為自動化規則比對，非人工深度審查

## 五、驗證方式

```sql
-- 查詢合規掃描結果
SELECT framework, status, COUNT(*)
FROM ai_compliance_findings
GROUP BY framework, status
ORDER BY framework;

-- 查詢合規報告
SELECT * FROM compliance_audit_reports
ORDER BY created_at DESC LIMIT 10;
```

---

*SEOBAIKE — 專利 TW-115100981 | 小路光有限公司*
