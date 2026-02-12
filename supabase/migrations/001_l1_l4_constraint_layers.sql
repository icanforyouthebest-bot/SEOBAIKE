-- ============================================================
-- SEOBAIKE L1-L4 約束層 Schema
-- 專利 115100981「世界定義約束法用於AI推理」
-- Frozen Reference Layer + 多國代碼對齊
-- ============================================================

-- 啟用必要擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 共用 trigger function: 自動更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 共用 trigger function: 凍結保護（禁止修改/刪除已凍結的 row）
-- ============================================================
CREATE OR REPLACE FUNCTION protect_frozen_row()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_frozen = true THEN
      RAISE EXCEPTION '此筆資料已凍結，無法刪除 (frozen_at: %)', OLD.frozen_at;
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE
  IF OLD.is_frozen = true THEN
    RAISE EXCEPTION '此筆資料已凍結，無法修改 (frozen_at: %)', OLD.frozen_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- L1: 宏觀產業類別
-- ============================================================
CREATE TABLE l1_categories (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       text UNIQUE NOT NULL,
  name_zh    text NOT NULL,
  name_en    text,
  tsic_code  text,
  naics_code text,
  nace_code  text,
  jsic_code  text,
  is_frozen  boolean DEFAULT false,
  frozen_at  timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_l1_tsic  ON l1_categories (tsic_code);
CREATE INDEX idx_l1_naics ON l1_categories (naics_code);
CREATE INDEX idx_l1_nace  ON l1_categories (nace_code);
CREATE INDEX idx_l1_jsic  ON l1_categories (jsic_code);

CREATE TRIGGER trg_l1_updated_at
  BEFORE UPDATE ON l1_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_l1_protect_frozen
  BEFORE UPDATE OR DELETE ON l1_categories
  FOR EACH ROW EXECUTE FUNCTION protect_frozen_row();

-- ============================================================
-- L2: 次產業分類
-- ============================================================
CREATE TABLE l2_subcategories (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  l1_id      uuid NOT NULL REFERENCES l1_categories(id) ON DELETE RESTRICT,
  code       text UNIQUE NOT NULL,
  name_zh    text NOT NULL,
  name_en    text,
  tsic_code  text,
  naics_code text,
  nace_code  text,
  jsic_code  text,
  is_frozen  boolean DEFAULT false,
  frozen_at  timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_l2_l1_id  ON l2_subcategories (l1_id);
CREATE INDEX idx_l2_tsic   ON l2_subcategories (tsic_code);
CREATE INDEX idx_l2_naics  ON l2_subcategories (naics_code);
CREATE INDEX idx_l2_nace   ON l2_subcategories (nace_code);
CREATE INDEX idx_l2_jsic   ON l2_subcategories (jsic_code);

CREATE TRIGGER trg_l2_updated_at
  BEFORE UPDATE ON l2_subcategories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_l2_protect_frozen
  BEFORE UPDATE OR DELETE ON l2_subcategories
  FOR EACH ROW EXECUTE FUNCTION protect_frozen_row();

-- ============================================================
-- L3: 製程/作業類型
-- ============================================================
CREATE TABLE l3_processes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  l2_id      uuid NOT NULL REFERENCES l2_subcategories(id) ON DELETE RESTRICT,
  code       text UNIQUE NOT NULL,
  name_zh    text NOT NULL,
  name_en    text,
  tsic_code  text,
  naics_code text,
  nace_code  text,
  jsic_code  text,
  is_frozen  boolean DEFAULT false,
  frozen_at  timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_l3_l2_id  ON l3_processes (l2_id);
CREATE INDEX idx_l3_tsic   ON l3_processes (tsic_code);
CREATE INDEX idx_l3_naics  ON l3_processes (naics_code);
CREATE INDEX idx_l3_nace   ON l3_processes (nace_code);
CREATE INDEX idx_l3_jsic   ON l3_processes (jsic_code);

CREATE TRIGGER trg_l3_updated_at
  BEFORE UPDATE ON l3_processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_l3_protect_frozen
  BEFORE UPDATE OR DELETE ON l3_processes
  FOR EACH ROW EXECUTE FUNCTION protect_frozen_row();

-- ============================================================
-- L4: 原子級工業節點
-- ============================================================
CREATE TABLE l4_nodes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  l3_id      uuid NOT NULL REFERENCES l3_processes(id) ON DELETE RESTRICT,
  code       text UNIQUE NOT NULL,
  name_zh    text NOT NULL,
  name_en    text,
  tsic_code  text,
  naics_code text,
  nace_code  text,
  jsic_code  text,
  is_frozen  boolean DEFAULT false,
  frozen_at  timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_l4_l3_id  ON l4_nodes (l3_id);
CREATE INDEX idx_l4_tsic   ON l4_nodes (tsic_code);
CREATE INDEX idx_l4_naics  ON l4_nodes (naics_code);
CREATE INDEX idx_l4_nace   ON l4_nodes (nace_code);
CREATE INDEX idx_l4_jsic   ON l4_nodes (jsic_code);

CREATE TRIGGER trg_l4_updated_at
  BEFORE UPDATE ON l4_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_l4_protect_frozen
  BEFORE UPDATE OR DELETE ON l4_nodes
  FOR EACH ROW EXECUTE FUNCTION protect_frozen_row();

-- ============================================================
-- Frozen Snapshots: 版本快照（不可竄改）
-- ============================================================
CREATE TABLE frozen_snapshots (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_tag   text UNIQUE NOT NULL,
  snapshot_data jsonb NOT NULL,
  description   text,
  created_by    text,
  created_at    timestamptz DEFAULT now()
);

-- RLS: frozen_snapshots 僅允許 INSERT，禁止 UPDATE/DELETE
ALTER TABLE frozen_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY frozen_snapshots_insert
  ON frozen_snapshots FOR INSERT
  WITH CHECK (true);

CREATE POLICY frozen_snapshots_select
  ON frozen_snapshots FOR SELECT
  USING (true);

-- 不建立 UPDATE/DELETE policy = 預設拒絕

-- ============================================================
-- 註解
-- ============================================================
COMMENT ON TABLE l1_categories     IS 'L1 宏觀產業類別 — 專利約束層第一層';
COMMENT ON TABLE l2_subcategories  IS 'L2 次產業分類 — 專利約束層第二層';
COMMENT ON TABLE l3_processes      IS 'L3 製程/作業類型 — 專利約束層第三層';
COMMENT ON TABLE l4_nodes          IS 'L4 原子級工業節點 — 專利約束層第四層';
COMMENT ON TABLE frozen_snapshots  IS 'Frozen Reference Layer 版本快照，建立後不可修改/刪除';
