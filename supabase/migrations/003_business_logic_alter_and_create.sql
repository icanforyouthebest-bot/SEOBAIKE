-- ============================================================
-- SEOBAIKE 商業邏輯：ALTER 補欄位 + 新建缺少的表
-- 策略：保留既有結構，補齊微軟版欄位
-- ============================================================

-- ============================================================
-- 1. users：補 phone, password_hash, status
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- ============================================================
-- 2. 新建 legal_entities（完全不存在）
-- ============================================================
CREATE TABLE legal_entities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  registration_no TEXT,
  country_code    TEXT NOT NULL,
  address         TEXT,
  type            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. 新建 roles + permissions（完全不存在）
-- ============================================================
CREATE TABLE roles (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE permissions (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- 4. user_roles：補 role_id FK（保留既有 role enum）
-- ============================================================
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- ============================================================
-- 5. merchants：補 owner_user_id, legal_entity_id, kyc_status
-- ============================================================
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS legal_entity_id UUID REFERENCES legal_entities(id);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'pending_kyc';

UPDATE merchants SET owner_user_id = user_id WHERE owner_user_id IS NULL;

-- ============================================================
-- 6. products：補 merchant_id, sku, price_cents, currency
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_cents BIGINT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'TWD';

-- ============================================================
-- 7. orders：補 customer_id, total_cents
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_cents BIGINT;

UPDATE orders SET customer_id = user_id WHERE customer_id IS NULL;
UPDATE orders SET total_cents = amount WHERE total_cents IS NULL;

-- ============================================================
-- 8. order_items：補 unit_price_cents
-- ============================================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price_cents BIGINT;

UPDATE order_items SET unit_price_cents = unit_price WHERE unit_price_cents IS NULL;

-- ============================================================
-- 9. 新建 payments
-- ============================================================
CREATE TABLE payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id),
  provider     TEXT NOT NULL,
  provider_ref TEXT,
  status       TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'TWD',
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. 新建 refunds
-- ============================================================
CREATE TABLE refunds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   UUID NOT NULL REFERENCES payments(id),
  amount_cents BIGINT NOT NULL,
  reason       TEXT,
  status       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. audit_logs：補 actor_user_id, actor_role_code, target_type, target_id
-- ============================================================
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role_code TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id UUID;

UPDATE audit_logs SET actor_user_id = user_id WHERE actor_user_id IS NULL AND user_id IS NOT NULL;
UPDATE audit_logs SET target_type = resource_type WHERE target_type IS NULL AND resource_type IS NOT NULL;

-- ============================================================
-- 12. 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_legal_entities_user ON legal_entities (user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_products_merchant ON products (merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders (merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds (payment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_user_id);
