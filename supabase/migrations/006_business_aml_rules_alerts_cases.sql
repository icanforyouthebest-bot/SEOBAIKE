-- ============================================================
-- SEOBAIKE 商業邏輯：AML 規則、警報、案件
-- ============================================================

-- AML 規則
CREATE TABLE aml_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,
  description       TEXT NOT NULL,
  threshold_amount  BIGINT,
  threshold_count   INT,
  time_window_hours INT,
  severity          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AML 警報
CREATE TABLE aml_alerts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id),
  merchant_id       UUID REFERENCES merchants(id),
  rule_id           UUID REFERENCES aml_rules(id),
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  details           JSONB,
  status            TEXT NOT NULL DEFAULT 'pending'
);

-- AML 案件
CREATE TABLE aml_cases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id          UUID REFERENCES aml_alerts(id),
  investigator_id   UUID REFERENCES users(id),
  status            TEXT NOT NULL DEFAULT 'open',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_aml_rules_code ON aml_rules (code);
CREATE INDEX idx_aml_alerts_user ON aml_alerts (user_id);
CREATE INDEX idx_aml_alerts_merchant ON aml_alerts (merchant_id);
CREATE INDEX idx_aml_alerts_status ON aml_alerts (status);
CREATE INDEX idx_aml_cases_alert ON aml_cases (alert_id);
CREATE INDEX idx_aml_cases_investigator ON aml_cases (investigator_id);
CREATE INDEX idx_aml_cases_status ON aml_cases (status);
