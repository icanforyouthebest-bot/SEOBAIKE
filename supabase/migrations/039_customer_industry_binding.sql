-- ============================================================
-- Migration 039: 客戶行業綁定 + AI 約束閘道
-- 專利 115100981 — 每個客戶綁定行業，AI 只在行業範圍內回答
-- ============================================================

-- ============================================================
-- 1. 客戶行業綁定表
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_industry_binding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text,
  platform_user_id text,
  bound_l1_id uuid NOT NULL REFERENCES l1_categories(id),
  bound_l2_id uuid REFERENCES l2_subcategories(id),
  industry_name_zh text NOT NULL,
  industry_name_en text,
  is_active boolean DEFAULT true,
  bound_at timestamptz DEFAULT now(),
  bound_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cib_user ON customer_industry_binding(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cib_platform ON customer_industry_binding(platform, platform_user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cib_l1 ON customer_industry_binding(bound_l1_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cib_unique_active ON customer_industry_binding(user_id) WHERE is_active = true;

ALTER TABLE customer_industry_binding ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. 行業關鍵字解析表
-- ============================================================
CREATE TABLE IF NOT EXISTS resolve_industry_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  l1_id uuid REFERENCES l1_categories(id),
  l2_id uuid REFERENCES l2_subcategories(id),
  weight int DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rik_keyword ON resolve_industry_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_rik_l1 ON resolve_industry_keywords(l1_id);

ALTER TABLE resolve_industry_keywords ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. L1-L4 行業種子資料（5 大行業）
-- ============================================================
DO $$
DECLARE
  v_health_l1 uuid;
  v_realestate_l1 uuid;
  v_food_l1 uuid;
  v_retail_l1 uuid;
  v_education_l1 uuid;
  -- L2
  v_dental uuid; v_tcm uuid; v_aesthetics uuid;
  v_agent uuid; v_dev uuid; v_rental uuid;
  v_restaurant uuid; v_cafe uuid; v_delivery uuid;
  v_ecommerce uuid; v_physical uuid; v_wholesale uuid;
  v_cram uuid; v_online uuid; v_corporate uuid;
  -- L3
  v_l3 uuid;
BEGIN
  -- ============ L1 ============
  INSERT INTO l1_categories (code, name_zh, name_en) VALUES
    ('HEALTH', '醫療健康', 'Healthcare')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_health_l1;

  INSERT INTO l1_categories (code, name_zh, name_en) VALUES
    ('REALESTATE', '房地產', 'Real Estate')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_realestate_l1;

  INSERT INTO l1_categories (code, name_zh, name_en) VALUES
    ('FOOD', '餐飲服務', 'Food & Beverage')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_food_l1;

  INSERT INTO l1_categories (code, name_zh, name_en) VALUES
    ('RETAIL', '零售電商', 'Retail & E-commerce')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_retail_l1;

  INSERT INTO l1_categories (code, name_zh, name_en) VALUES
    ('EDUCATION', '教育培訓', 'Education & Training')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_education_l1;

  -- ============ L2: 醫療健康 ============
  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_health_l1, 'HEALTH_DENTAL', '牙醫診所', 'Dental Clinic')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_dental;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_health_l1, 'HEALTH_TCM', '中醫診所', 'Traditional Chinese Medicine')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_tcm;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_health_l1, 'HEALTH_AESTHETICS', '美容醫學', 'Aesthetic Medicine')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_aesthetics;

  -- ============ L2: 房地產 ============
  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_realestate_l1, 'RE_AGENT', '房仲', 'Real Estate Agent')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_agent;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_realestate_l1, 'RE_DEVELOPMENT', '建案銷售', 'Property Development')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_dev;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_realestate_l1, 'RE_RENTAL', '租賃管理', 'Rental Management')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_rental;

  -- ============ L2: 餐飲 ============
  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_food_l1, 'FOOD_RESTAURANT', '餐廳', 'Restaurant')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_restaurant;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_food_l1, 'FOOD_CAFE', '咖啡廳', 'Cafe')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_cafe;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_food_l1, 'FOOD_DELIVERY', '外送平台', 'Food Delivery')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_delivery;

  -- ============ L2: 零售 ============
  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_retail_l1, 'RETAIL_ECOMMERCE', '網路商店', 'E-commerce')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_ecommerce;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_retail_l1, 'RETAIL_PHYSICAL', '實體零售', 'Physical Retail')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_physical;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_retail_l1, 'RETAIL_WHOLESALE', '批發', 'Wholesale')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_wholesale;

  -- ============ L2: 教育 ============
  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_education_l1, 'EDU_CRAM', '補習班', 'Cram School')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_cram;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_education_l1, 'EDU_ONLINE', '線上課程', 'Online Course')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_online;

  INSERT INTO l2_subcategories (l1_id, code, name_zh, name_en) VALUES
    (v_education_l1, 'EDU_CORPORATE', '企業培訓', 'Corporate Training')
  ON CONFLICT (code) DO UPDATE SET name_zh = EXCLUDED.name_zh
  RETURNING id INTO v_corporate;

  -- ============ L3: 各行業核心流程 ============
  -- 醫療: 牙醫
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_dental, 'DENTAL_TREATMENT', '牙科治療', 'Dental Treatment')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_dental, 'DENTAL_CONSULT', '牙科諮詢', 'Dental Consultation')
  ON CONFLICT (code) DO NOTHING;

  -- 醫療: 中醫
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_tcm, 'TCM_DIAGNOSIS', '中醫診斷', 'TCM Diagnosis')
  ON CONFLICT (code) DO NOTHING;

  -- 醫療: 美容
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_aesthetics, 'AESTHETICS_CONSULT', '美容諮詢', 'Aesthetics Consultation')
  ON CONFLICT (code) DO NOTHING;

  -- 房地產: 房仲
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_agent, 'RE_LISTING', '物件刊登', 'Property Listing')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_agent, 'RE_SHOWING', '帶看服務', 'Property Showing')
  ON CONFLICT (code) DO NOTHING;

  -- 房地產: 建案
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_dev, 'RE_PRESALE', '預售作業', 'Pre-sale')
  ON CONFLICT (code) DO NOTHING;

  -- 房地產: 租賃
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_rental, 'RE_LEASE', '租約管理', 'Lease Management')
  ON CONFLICT (code) DO NOTHING;

  -- 餐飲
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_restaurant, 'FOOD_MENU', '菜單管理', 'Menu Management')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_restaurant, 'FOOD_ORDER', '訂單處理', 'Order Processing')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_cafe, 'CAFE_OPERATION', '咖啡廳營運', 'Cafe Operations')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_delivery, 'DELIVERY_LOGISTICS', '外送物流', 'Delivery Logistics')
  ON CONFLICT (code) DO NOTHING;

  -- 零售
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_ecommerce, 'ECOM_PRODUCT', '商品管理', 'Product Management')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_ecommerce, 'ECOM_MARKETING', '行銷推廣', 'Marketing')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_physical, 'PHYS_INVENTORY', '庫存管理', 'Inventory Management')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_wholesale, 'WHOLE_SUPPLY', '供應鏈', 'Supply Chain')
  ON CONFLICT (code) DO NOTHING;

  -- 教育
  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_cram, 'CRAM_CURRICULUM', '課程規劃', 'Curriculum Planning')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_online, 'ONLINE_CONTENT', '內容製作', 'Content Production')
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO l3_processes (l2_id, code, name_zh, name_en) VALUES
    (v_corporate, 'CORP_PROGRAM', '培訓方案', 'Training Program')
  ON CONFLICT (code) DO NOTHING;

  -- ============ constraint_paths: allow 規則（每個 L1 允許自身行業） ============
  INSERT INTO constraint_paths (l1_id, path_type, priority, reason, created_by) VALUES
    (v_health_l1, 'allow', 10, '醫療健康行業允許推理', 'migration_039'),
    (v_realestate_l1, 'allow', 10, '房地產行業允許推理', 'migration_039'),
    (v_food_l1, 'allow', 10, '餐飲服務行業允許推理', 'migration_039'),
    (v_retail_l1, 'allow', 10, '零售電商行業允許推理', 'migration_039'),
    (v_education_l1, 'allow', 10, '教育培訓行業允許推理', 'migration_039')
  ON CONFLICT DO NOTHING;

  -- ============ 行業關鍵字 ============
  -- 醫療健康
  INSERT INTO resolve_industry_keywords (keyword, l1_id, l2_id, weight) VALUES
    ('牙齒', v_health_l1, v_dental, 3), ('蛀牙', v_health_l1, v_dental, 3),
    ('植牙', v_health_l1, v_dental, 3), ('矯正', v_health_l1, v_dental, 3),
    ('洗牙', v_health_l1, v_dental, 3), ('根管', v_health_l1, v_dental, 3),
    ('假牙', v_health_l1, v_dental, 3), ('牙周', v_health_l1, v_dental, 3),
    ('口腔', v_health_l1, v_dental, 2), ('牙醫', v_health_l1, v_dental, 3),
    ('看診', v_health_l1, NULL, 2), ('掛號', v_health_l1, NULL, 2),
    ('病人', v_health_l1, NULL, 2), ('患者', v_health_l1, NULL, 2),
    ('醫療', v_health_l1, NULL, 2), ('診所', v_health_l1, NULL, 2),
    ('健保', v_health_l1, NULL, 2), ('藥', v_health_l1, NULL, 1),
    ('中醫', v_health_l1, v_tcm, 3), ('針灸', v_health_l1, v_tcm, 3),
    ('推拿', v_health_l1, v_tcm, 3), ('中藥', v_health_l1, v_tcm, 3),
    ('美容', v_health_l1, v_aesthetics, 2), ('微整形', v_health_l1, v_aesthetics, 3),
    ('雷射', v_health_l1, v_aesthetics, 2), ('玻尿酸', v_health_l1, v_aesthetics, 3);

  -- 房地產
  INSERT INTO resolve_industry_keywords (keyword, l1_id, l2_id, weight) VALUES
    ('房子', v_realestate_l1, NULL, 3), ('買房', v_realestate_l1, NULL, 3),
    ('賣房', v_realestate_l1, NULL, 3), ('房屋', v_realestate_l1, NULL, 3),
    ('坪數', v_realestate_l1, NULL, 3), ('房價', v_realestate_l1, NULL, 3),
    ('地段', v_realestate_l1, NULL, 2), ('物件', v_realestate_l1, v_agent, 2),
    ('仲介', v_realestate_l1, v_agent, 3), ('帶看', v_realestate_l1, v_agent, 3),
    ('成交', v_realestate_l1, v_agent, 2), ('斡旋', v_realestate_l1, v_agent, 3),
    ('建案', v_realestate_l1, v_dev, 3), ('預售', v_realestate_l1, v_dev, 3),
    ('新建', v_realestate_l1, v_dev, 2), ('工地', v_realestate_l1, v_dev, 2),
    ('租屋', v_realestate_l1, v_rental, 3), ('房租', v_realestate_l1, v_rental, 3),
    ('租約', v_realestate_l1, v_rental, 3), ('押金', v_realestate_l1, v_rental, 2);

  -- 餐飲
  INSERT INTO resolve_industry_keywords (keyword, l1_id, l2_id, weight) VALUES
    ('餐廳', v_food_l1, v_restaurant, 3), ('菜單', v_food_l1, v_restaurant, 3),
    ('訂位', v_food_l1, v_restaurant, 3), ('出餐', v_food_l1, v_restaurant, 2),
    ('食材', v_food_l1, NULL, 2), ('廚房', v_food_l1, NULL, 2),
    ('料理', v_food_l1, NULL, 2), ('餐點', v_food_l1, NULL, 2),
    ('咖啡', v_food_l1, v_cafe, 3), ('拿鐵', v_food_l1, v_cafe, 3),
    ('沖泡', v_food_l1, v_cafe, 2), ('豆子', v_food_l1, v_cafe, 2),
    ('外送', v_food_l1, v_delivery, 3), ('送餐', v_food_l1, v_delivery, 3),
    ('配送', v_food_l1, v_delivery, 2), ('騎手', v_food_l1, v_delivery, 2);

  -- 零售
  INSERT INTO resolve_industry_keywords (keyword, l1_id, l2_id, weight) VALUES
    ('商品', v_retail_l1, NULL, 2), ('庫存', v_retail_l1, NULL, 2),
    ('訂單', v_retail_l1, NULL, 2), ('出貨', v_retail_l1, NULL, 2),
    ('電商', v_retail_l1, v_ecommerce, 3), ('網購', v_retail_l1, v_ecommerce, 3),
    ('上架', v_retail_l1, v_ecommerce, 2), ('購物車', v_retail_l1, v_ecommerce, 3),
    ('門市', v_retail_l1, v_physical, 3), ('店面', v_retail_l1, v_physical, 3),
    ('收銀', v_retail_l1, v_physical, 2), ('陳列', v_retail_l1, v_physical, 2),
    ('批發', v_retail_l1, v_wholesale, 3), ('進貨', v_retail_l1, v_wholesale, 3),
    ('供應商', v_retail_l1, v_wholesale, 2), ('報價', v_retail_l1, v_wholesale, 2);

  -- 教育
  INSERT INTO resolve_industry_keywords (keyword, l1_id, l2_id, weight) VALUES
    ('課程', v_education_l1, NULL, 2), ('學生', v_education_l1, NULL, 2),
    ('教學', v_education_l1, NULL, 2), ('老師', v_education_l1, NULL, 2),
    ('補習', v_education_l1, v_cram, 3), ('考試', v_education_l1, v_cram, 2),
    ('升學', v_education_l1, v_cram, 3), ('班級', v_education_l1, v_cram, 2),
    ('線上', v_education_l1, v_online, 2), ('影片', v_education_l1, v_online, 2),
    ('平台', v_education_l1, v_online, 1), ('直播', v_education_l1, v_online, 2),
    ('企業培訓', v_education_l1, v_corporate, 3), ('內訓', v_education_l1, v_corporate, 3),
    ('人資', v_education_l1, v_corporate, 2), ('講師', v_education_l1, v_corporate, 2);

  RAISE NOTICE '=== 種子資料完成：5 L1 + 15 L2 + 18 L3 + 120 關鍵字 ===';
END;
$$;

-- ============================================================
-- 4. 關鍵字解析函數
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_query_industry(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result record;
  v_total_weight int := 0;
BEGIN
  -- 關鍵字加權比對
  SELECT
    rik.l1_id,
    l1.code AS l1_code,
    l1.name_zh AS l1_name,
    rik.l2_id,
    SUM(rik.weight) AS total_weight
  INTO v_result
  FROM resolve_industry_keywords rik
  JOIN l1_categories l1 ON l1.id = rik.l1_id
  WHERE p_text LIKE '%' || rik.keyword || '%'
  GROUP BY rik.l1_id, l1.code, l1.name_zh, rik.l2_id
  ORDER BY SUM(rik.weight) DESC
  LIMIT 1;

  IF v_result.l1_id IS NULL THEN
    RETURN jsonb_build_object('resolved', false, 'reason', '未匹配任何行業關鍵字');
  END IF;

  RETURN jsonb_build_object(
    'resolved', true,
    'l1_id', v_result.l1_id,
    'l1_code', v_result.l1_code,
    'l1_name', v_result.l1_name,
    'l2_id', v_result.l2_id,
    'weight', v_result.total_weight
  );
END;
$$;

-- ============================================================
-- 5. 核心約束閘道函數
-- ============================================================
CREATE OR REPLACE FUNCTION constrained_ai_chat(
  p_platform_user_id text,
  p_platform text,
  p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_binding record;
  v_resolved jsonb;
  v_resolved_l1 uuid;
  v_session_id text;
  v_path_check jsonb;
  v_system_addon text;
  v_l2_name text;
  v_audit_id uuid;
BEGIN
  v_session_id := 'ai-chat:' || p_platform || ':' || p_platform_user_id || ':' || extract(epoch from now())::text;

  -- -------------------------------------------------------
  -- Step 1: 查客戶綁定
  -- -------------------------------------------------------
  SELECT cib.*, l1.code AS l1_code, l1.name_zh AS l1_name
  INTO v_binding
  FROM customer_industry_binding cib
  JOIN l1_categories l1 ON l1.id = cib.bound_l1_id
  WHERE cib.platform = p_platform
    AND cib.platform_user_id = p_platform_user_id
    AND cib.is_active = true
  LIMIT 1;

  -- 沒有綁定 → 也查 user_id（web 模式可能只有 user_id）
  IF v_binding.id IS NULL THEN
    SELECT cib.*, l1.code AS l1_code, l1.name_zh AS l1_name
    INTO v_binding
    FROM customer_industry_binding cib
    JOIN l1_categories l1 ON l1.id = cib.bound_l1_id
    WHERE cib.platform_user_id = p_platform_user_id
      AND cib.is_active = true
    LIMIT 1;
  END IF;

  IF v_binding.id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', '您尚未綁定行業。請聯繫管理員設定您的行業類別。',
      'error_code', 'NO_BINDING',
      'session_id', v_session_id
    );
  END IF;

  -- -------------------------------------------------------
  -- Step 2: 解析用戶訊息的行業關鍵字
  -- -------------------------------------------------------
  v_resolved := resolve_query_industry(p_message);

  -- 如果無法解析關鍵字 → 仍允許（可能是一般性問題，由 system prompt 約束）
  IF NOT (v_resolved->>'resolved')::boolean THEN
    -- 無特定行業關鍵字，視為行業內一般問題
    v_resolved_l1 := v_binding.bound_l1_id;
  ELSE
    v_resolved_l1 := (v_resolved->>'l1_id')::uuid;
  END IF;

  -- -------------------------------------------------------
  -- Step 3: 跨行業檢查
  -- -------------------------------------------------------
  IF v_resolved_l1 IS DISTINCT FROM v_binding.bound_l1_id
     AND (v_resolved->>'resolved')::boolean THEN
    -- 寫入 audit trail（denied）
    INSERT INTO inference_audit_trail (
      session_id, model_type, model_identifier, task_type,
      input_summary, resolved_l1_id, inference_status,
      traceback_chain
    ) VALUES (
      v_session_id, 'llm', 'nvidia/constrained', 'other',
      left(p_message, 200),
      v_resolved_l1, 'failed',
      jsonb_build_object(
        'bound_l1', v_binding.l1_code,
        'query_l1', v_resolved->>'l1_code',
        'reason', 'cross_industry_denied'
      )
    );

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format(
        '您的帳號綁定「%s」行業。您的問題涉及「%s」，屬於跨行業範圍，無法回答。請提出與「%s」相關的問題。',
        v_binding.industry_name_zh,
        v_resolved->>'l1_name',
        v_binding.industry_name_zh
      ),
      'error_code', 'CROSS_INDUSTRY',
      'bound_industry', v_binding.industry_name_zh,
      'query_industry', v_resolved->>'l1_name',
      'session_id', v_session_id
    );
  END IF;

  -- -------------------------------------------------------
  -- Step 4: 呼叫 check_inference_path()
  -- -------------------------------------------------------
  v_path_check := check_inference_path(
    v_session_id,
    v_binding.bound_l1_id,
    v_binding.bound_l2_id,
    NULL, NULL,
    jsonb_build_object('message', left(p_message, 500), 'platform', p_platform)
  );

  IF v_path_check->>'verdict' IN ('denied', 'halted') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', v_path_check->>'reason',
      'error_code', 'PATH_DENIED',
      'session_id', v_session_id
    );
  END IF;

  -- -------------------------------------------------------
  -- Step 5: 通過！組裝行業約束 system prompt
  -- -------------------------------------------------------
  SELECT name_zh INTO v_l2_name FROM l2_subcategories WHERE id = v_binding.bound_l2_id;

  v_system_addon := format(
    '你是「%s」行業的專業 AI 助手（專精：%s）。'
    || '你只能回答與「%s」相關的問題。'
    || '如果用戶問到與你專業無關的問題，請禮貌拒絕並引導回「%s」領域。'
    || '請用繁體中文回答，專業但親切。',
    v_binding.industry_name_zh,
    COALESCE(v_l2_name, v_binding.industry_name_zh),
    v_binding.industry_name_zh,
    v_binding.industry_name_zh
  );

  -- 寫入 audit trail（pending — 等 NVIDIA 回覆後更新）
  INSERT INTO inference_audit_trail (
    session_id, model_type, model_identifier, task_type,
    input_summary, resolved_l1_id, resolved_l2_id,
    path_check_id, inference_status,
    traceback_chain
  ) VALUES (
    v_session_id, 'llm', 'nvidia/constrained', 'other',
    left(p_message, 200),
    v_binding.bound_l1_id, v_binding.bound_l2_id,
    (v_path_check->>'check_id')::uuid, 'partial',
    jsonb_build_object(
      'bound_l1', v_binding.l1_code,
      'bound_industry', v_binding.industry_name_zh,
      'path_verdict', v_path_check->>'verdict'
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'session_id', v_session_id,
    'audit_id', v_audit_id,
    'bound_l1_id', v_binding.bound_l1_id,
    'bound_l2_id', v_binding.bound_l2_id,
    'industry_name_zh', v_binding.industry_name_zh,
    'system_prompt_addon', v_system_addon,
    'path_check', v_path_check
  );
END;
$$;

-- ============================================================
-- 6. 更新 audit trail（NVIDIA 回覆後）
-- ============================================================
CREATE OR REPLACE FUNCTION update_ai_audit(
  p_audit_id uuid,
  p_output_summary text,
  p_status text DEFAULT 'success'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE inference_audit_trail SET
    output_summary = left(p_output_summary, 500),
    inference_status = p_status,
    completed_at = now()
  WHERE id = p_audit_id;
END;
$$;

-- ============================================================
-- 驗證
-- ============================================================
DO $$
DECLARE
  v_l1_count int;
  v_l2_count int;
  v_kw_count int;
  v_cp_count int;
BEGIN
  SELECT count(*) INTO v_l1_count FROM l1_categories WHERE code IN ('HEALTH','REALESTATE','FOOD','RETAIL','EDUCATION');
  SELECT count(*) INTO v_l2_count FROM l2_subcategories WHERE code LIKE 'HEALTH_%' OR code LIKE 'RE_%' OR code LIKE 'FOOD_%' OR code LIKE 'RETAIL_%' OR code LIKE 'EDU_%';
  SELECT count(*) INTO v_kw_count FROM resolve_industry_keywords;
  SELECT count(*) INTO v_cp_count FROM constraint_paths WHERE created_by = 'migration_039';

  RAISE NOTICE '=== Migration 039: 客戶行業綁定 ===';
  RAISE NOTICE 'L1 行業: %', v_l1_count;
  RAISE NOTICE 'L2 子行業: %', v_l2_count;
  RAISE NOTICE '關鍵字: %', v_kw_count;
  RAISE NOTICE 'constraint_paths: %', v_cp_count;
  RAISE NOTICE 'customer_industry_binding ✓ | resolve_industry_keywords ✓';
  RAISE NOTICE 'constrained_ai_chat() ✓ | resolve_query_industry() ✓ | update_ai_audit() ✓';
END;
$$;
