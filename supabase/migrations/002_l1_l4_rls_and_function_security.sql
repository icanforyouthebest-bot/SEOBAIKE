-- ============================================================
-- SEOBAIKE L1-L4 安全性強化 Migration
-- 1. 對 L1-L4 四張表啟用 RLS + 建立存取政策
-- 2. 修正 function search_path 為不可變
-- ============================================================

-- ============================================================
-- 1. 啟用 RLS
-- ============================================================
ALTER TABLE l1_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE l2_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE l3_processes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE l4_nodes         ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. SELECT 政策：所有人可讀（約束層為公開參考資料）
-- ============================================================
CREATE POLICY l1_select ON l1_categories    FOR SELECT USING (true);
CREATE POLICY l2_select ON l2_subcategories FOR SELECT USING (true);
CREATE POLICY l3_select ON l3_processes     FOR SELECT USING (true);
CREATE POLICY l4_select ON l4_nodes         FOR SELECT USING (true);

-- ============================================================
-- 3. INSERT 政策：僅 service_role 可新增
-- ============================================================
CREATE POLICY l1_insert ON l1_categories    FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY l2_insert ON l2_subcategories FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY l3_insert ON l3_processes     FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY l4_insert ON l4_nodes         FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================
-- 4. UPDATE 政策：僅 service_role 可修改（仍受 frozen trigger 保護）
-- ============================================================
CREATE POLICY l1_update ON l1_categories    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY l2_update ON l2_subcategories FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY l3_update ON l3_processes     FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY l4_update ON l4_nodes         FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 5. DELETE 政策：僅 service_role 可刪除（仍受 frozen trigger 保護）
-- ============================================================
CREATE POLICY l1_delete ON l1_categories    FOR DELETE TO service_role USING (true);
CREATE POLICY l2_delete ON l2_subcategories FOR DELETE TO service_role USING (true);
CREATE POLICY l3_delete ON l3_processes     FOR DELETE TO service_role USING (true);
CREATE POLICY l4_delete ON l4_nodes         FOR DELETE TO service_role USING (true);

-- ============================================================
-- 6. 修正 function search_path（消除 mutable search_path 警告）
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

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
$$ LANGUAGE plpgsql SET search_path = '';
