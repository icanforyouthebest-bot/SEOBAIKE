-- ============================================================
-- SEOBAIKE 商業邏輯：抽佣、反傭、退傭
-- ============================================================

-- 抽佣規則
CREATE TABLE commission_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID REFERENCES merchants(id),
  name              TEXT NOT NULL,
  type              TEXT NOT NULL,
  rate_basis        TEXT NOT NULL DEFAULT 'order_total',
  percentage_bp     INT,
  fixed_cents       BIGINT,
  max_cents         BIGINT,
  min_cents         BIGINT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 抽佣計算結果
CREATE TABLE commission_payouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID NOT NULL REFERENCES merchants(id),
  order_id          UUID NOT NULL REFERENCES orders(id),
  rule_id           UUID REFERENCES commission_rules(id),
  gross_cents       BIGINT NOT NULL,
  commission_cents  BIGINT NOT NULL,
  net_cents         BIGINT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  reason_blocked    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 反傭／退傭偵測與回收
CREATE TABLE commission_clawbacks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id         UUID NOT NULL REFERENCES commission_payouts(id),
  reason            TEXT NOT NULL,
  amount_cents      BIGINT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'initiated',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 反傭風險模式紀錄
CREATE TABLE anti_kickback_patterns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID REFERENCES merchants(id),
  pattern_type      TEXT NOT NULL,
  description       TEXT,
  score             INT NOT NULL,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_commission_rules_merchant ON commission_rules (merchant_id);
CREATE INDEX idx_commission_payouts_merchant ON commission_payouts (merchant_id);
CREATE INDEX idx_commission_payouts_order ON commission_payouts (order_id);
CREATE INDEX idx_commission_payouts_status ON commission_payouts (status);
CREATE INDEX idx_clawbacks_payout ON commission_clawbacks (payout_id);
CREATE INDEX idx_clawbacks_status ON commission_clawbacks (status);
CREATE INDEX idx_antikickback_merchant ON anti_kickback_patterns (merchant_id);
CREATE INDEX idx_antikickback_score ON anti_kickback_patterns (score);
