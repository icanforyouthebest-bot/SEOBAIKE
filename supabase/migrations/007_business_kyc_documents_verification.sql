-- ============================================================
-- SEOBAIKE 商業邏輯：KYC 文件上傳 + 驗證紀錄
-- ============================================================

-- KYC 文件
CREATE TABLE kyc_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  type              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  file_url          TEXT,
  metadata          JSONB,
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KYC 驗證紀錄
CREATE TABLE kyc_verification (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  level             TEXT NOT NULL,
  status            TEXT NOT NULL,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_kyc_documents_user ON kyc_documents (user_id);
CREATE INDEX idx_kyc_documents_status ON kyc_documents (status);
CREATE INDEX idx_kyc_verification_user ON kyc_verification (user_id);
CREATE INDEX idx_kyc_verification_status ON kyc_verification (status);
