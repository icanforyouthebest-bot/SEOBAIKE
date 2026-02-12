-- ============================================================
-- AML 風控規則種子資料
-- 基於 L2 AML 風控標準作業程序
-- 金額單位：cents（分），NT$500,000 = 50000000 cents
-- ============================================================

INSERT INTO aml_rules (code, description, threshold_amount, threshold_count, time_window_hours, severity) VALUES
('HIGH_VALUE_TX',       '單筆高額交易：超過 NT$500,000 須申報',                    50000000, NULL, NULL, 'high'),
('RAPID_TX',            '短時間密集交易：1小時內同一帳戶超過5筆',                   NULL,     5,    1,    'high'),
('DAILY_AGGREGATE',     '每日累計交易金額：同一帳戶單日累計超過 NT$1,000,000',      100000000, NULL, 24,  'high'),
('STRUCTURING',         '拆分交易規避申報門檻：多筆接近門檻之交易',                 45000000, 3,    24,   'critical'),
('MULTI_ACCOUNT',       '多帳戶關聯交易：同一裝置或 IP 操作多個帳戶',               NULL,     3,    24,   'high'),
('DORMANT_REACTIVATE',  '休眠帳戶突然活躍：90天無交易後突然大額交易',               10000000, NULL, NULL, 'medium'),
('CROSS_BORDER',        '跨境交易監控：涉及高風險國家/地區之交易',                  NULL,     NULL, NULL, 'high'),
('ROUND_AMOUNT',        '整數金額交易：頻繁出現整數金額之交易模式',                 NULL,     5,    24,   'medium'),
('RAPID_REFUND',        '快速退款模式：付款後短時間內申請退款',                     NULL,     3,    48,   'high'),
('PEP_TRANSACTION',     '政治敏感人物交易：涉及 PEP 名單之交易須加強審查',          NULL,     NULL, NULL, 'critical'),
('SELF_DEALING',        '自我交易：商家與客戶為同一關聯人',                         NULL,     NULL, NULL, 'critical'),
('CIRCULAR_FUND',       '資金循環：資金在關聯帳戶間循環流動',                       NULL,     3,    72,   'critical')
ON CONFLICT DO NOTHING;
