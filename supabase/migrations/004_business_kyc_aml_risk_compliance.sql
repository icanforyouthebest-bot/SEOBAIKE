-- ============================================================
-- SEOBAIKE 商業邏輯：KYC/AML、風險標記、台灣法規、合規檢查
-- ============================================================

-- KYC / AML 資料
CREATE TABLE kyc_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity_id   UUID NOT NULL REFERENCES legal_entities(id),
  level             TEXT NOT NULL,
  status            TEXT NOT NULL,
  reviewer_user_id  UUID,
  reviewed_at       TIMESTAMPTZ,
  data              JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 風險標記
CREATE TABLE risk_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID REFERENCES merchants(id),
  user_id           UUID REFERENCES users(id),
  source            TEXT NOT NULL,
  type              TEXT NOT NULL,
  severity          TEXT NOT NULL,
  description       TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 法規對應紀錄（台灣法條）
CREATE TABLE legal_references_tw (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL,
  law_name          TEXT NOT NULL,
  article           TEXT,
  description       TEXT
);

-- 合規檢查結果
CREATE TABLE compliance_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID REFERENCES merchants(id),
  order_id          UUID REFERENCES orders(id),
  check_type        TEXT NOT NULL,
  status            TEXT NOT NULL,
  legal_reference_id UUID REFERENCES legal_references_tw(id),
  details           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_kyc_legal_entity ON kyc_records (legal_entity_id);
CREATE INDEX idx_kyc_status ON kyc_records (status);
CREATE INDEX idx_risk_flags_merchant ON risk_flags (merchant_id);
CREATE INDEX idx_risk_flags_user ON risk_flags (user_id);
CREATE INDEX idx_risk_flags_severity ON risk_flags (severity);
CREATE INDEX idx_compliance_merchant ON compliance_checks (merchant_id);
CREATE INDEX idx_compliance_order ON compliance_checks (order_id);
CREATE INDEX idx_compliance_status ON compliance_checks (status);
