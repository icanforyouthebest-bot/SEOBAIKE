# MCP L1-L4 對應表（微軟 9 份檔案）

| 檔名 | 模組 | MCP 層級 | 角色說明 |
|------|------|----------|----------|
| schema_core.sql | 核心帳號／商家／訂單 | L1 | 定義主體、交易、審計的資料邊界與結構 |
| schema_compliance_tw.sql | 台灣合規／KYC／風險標記 | L1 | 定義合規、風險、法條對應的資料邊界 |
| schema_commission_anti_kickback.sql | 抽佣／反傭退傭 | L1 | 定義抽佣、退傭、反傭模式的資料邊界 |
| schema_aml.sql | AML 規則／警示／案件 | L1 | 定義反洗錢規則與案件管理的資料邊界 |
| schema_kyc.sql | KYC 文件／驗證 | L1 | 定義 KYC 文件與驗證狀態的資料邊界 |
| aml_engine.ts | AML 規則引擎 | L2 | 讀取 L1 資料，套用 AML 規則產生警示 |
| kyc_engine.ts | KYC 評估引擎 | L2 | 讀取 L1 KYC 資料，產生通過／失敗判定 |
| edge/order_created.ts | 訂單建立流程 | L3 (Edge) | 串 L1/L2，決定訂單是否成立與抽佣預備 |
| edge/payment_captured.ts | 付款成功流程 | L3 (Edge) | 串 L1/L2，計算抽佣、偵測反傭、更新風險狀態 |

## 層級架構

```
L1（資料邊界）     5 組 Schema → 27 張表
    ↓
L2（規則引擎）     aml_engine.ts / kyc_engine.ts
    ↓
L3（業務流程）     order-created / payment-captured Edge Functions
    ↓
L4（操作節點）     測試、稽核、CI/CD、SCA/SBOM、異常通報
```

## 對應到 Supabase Migrations

| 微軟原始檔名 | SEOBAIKE Migration |
|-------------|-------------------|
| schema_core.sql | 003_business_logic_alter_and_create.sql |
| schema_compliance_tw.sql | 004_business_kyc_aml_risk_compliance.sql |
| schema_commission_anti_kickback.sql | 005_business_commission_clawback_antikickback.sql |
| schema_aml.sql | 006_business_aml_rules_alerts_cases.sql |
| schema_kyc.sql | 007_business_kyc_documents_verification.sql |
