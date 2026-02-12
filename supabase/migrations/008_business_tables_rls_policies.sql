-- ============================================================
-- SEOBAIKE 商業邏輯表 RLS 安全政策
-- 策略：全部啟用 RLS，service_role 完全存取，
--       一般用戶僅能讀取公開參考表（roles/permissions/legal_references_tw）
-- ============================================================

-- ============================================================
-- 1. 啟用 RLS（20 張表）
-- ============================================================

-- 核心
ALTER TABLE legal_entities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds           ENABLE ROW LEVEL SECURITY;

-- KYC / AML
ALTER TABLE kyc_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verification  ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags        ENABLE ROW LEVEL SECURITY;

-- 合規
ALTER TABLE compliance_checks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_references_tw ENABLE ROW LEVEL SECURITY;

-- 抽佣 / 反傭
ALTER TABLE commission_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_clawbacks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE anti_kickback_patterns ENABLE ROW LEVEL SECURITY;

-- AML
ALTER TABLE aml_rules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_alerts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_cases   ENABLE ROW LEVEL SECURITY;

-- 既有
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. 公開參考表：所有人可讀，僅 service_role 可寫
-- ============================================================

-- roles
CREATE POLICY roles_select ON roles FOR SELECT USING (true);
CREATE POLICY roles_insert ON roles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY roles_update ON roles FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY roles_delete ON roles FOR DELETE TO service_role USING (true);

-- permissions
CREATE POLICY permissions_select ON permissions FOR SELECT USING (true);
CREATE POLICY permissions_insert ON permissions FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY permissions_update ON permissions FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY permissions_delete ON permissions FOR DELETE TO service_role USING (true);

-- role_permissions
CREATE POLICY role_perms_select ON role_permissions FOR SELECT USING (true);
CREATE POLICY role_perms_insert ON role_permissions FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY role_perms_delete ON role_permissions FOR DELETE TO service_role USING (true);

-- legal_references_tw
CREATE POLICY legal_ref_select ON legal_references_tw FOR SELECT USING (true);
CREATE POLICY legal_ref_insert ON legal_references_tw FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY legal_ref_update ON legal_references_tw FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY legal_ref_delete ON legal_references_tw FOR DELETE TO service_role USING (true);

-- ============================================================
-- 3. 敏感商業表：僅 service_role 完全存取
-- ============================================================

-- legal_entities
CREATE POLICY legal_entities_select ON legal_entities FOR SELECT TO service_role USING (true);
CREATE POLICY legal_entities_insert ON legal_entities FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY legal_entities_update ON legal_entities FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY legal_entities_delete ON legal_entities FOR DELETE TO service_role USING (true);

-- payments
CREATE POLICY payments_select ON payments FOR SELECT TO service_role USING (true);
CREATE POLICY payments_insert ON payments FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY payments_update ON payments FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY payments_delete ON payments FOR DELETE TO service_role USING (true);

-- refunds
CREATE POLICY refunds_select ON refunds FOR SELECT TO service_role USING (true);
CREATE POLICY refunds_insert ON refunds FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY refunds_update ON refunds FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY refunds_delete ON refunds FOR DELETE TO service_role USING (true);

-- kyc_records
CREATE POLICY kyc_records_select ON kyc_records FOR SELECT TO service_role USING (true);
CREATE POLICY kyc_records_insert ON kyc_records FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY kyc_records_update ON kyc_records FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY kyc_records_delete ON kyc_records FOR DELETE TO service_role USING (true);

-- kyc_documents
CREATE POLICY kyc_docs_select ON kyc_documents FOR SELECT TO service_role USING (true);
CREATE POLICY kyc_docs_insert ON kyc_documents FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY kyc_docs_update ON kyc_documents FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY kyc_docs_delete ON kyc_documents FOR DELETE TO service_role USING (true);

-- kyc_verification
CREATE POLICY kyc_verif_select ON kyc_verification FOR SELECT TO service_role USING (true);
CREATE POLICY kyc_verif_insert ON kyc_verification FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY kyc_verif_update ON kyc_verification FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY kyc_verif_delete ON kyc_verification FOR DELETE TO service_role USING (true);

-- risk_flags
CREATE POLICY risk_flags_select ON risk_flags FOR SELECT TO service_role USING (true);
CREATE POLICY risk_flags_insert ON risk_flags FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY risk_flags_update ON risk_flags FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY risk_flags_delete ON risk_flags FOR DELETE TO service_role USING (true);

-- compliance_checks
CREATE POLICY compliance_select ON compliance_checks FOR SELECT TO service_role USING (true);
CREATE POLICY compliance_insert ON compliance_checks FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY compliance_update ON compliance_checks FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY compliance_delete ON compliance_checks FOR DELETE TO service_role USING (true);

-- commission_rules
CREATE POLICY comm_rules_select ON commission_rules FOR SELECT TO service_role USING (true);
CREATE POLICY comm_rules_insert ON commission_rules FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY comm_rules_update ON commission_rules FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY comm_rules_delete ON commission_rules FOR DELETE TO service_role USING (true);

-- commission_payouts
CREATE POLICY comm_payouts_select ON commission_payouts FOR SELECT TO service_role USING (true);
CREATE POLICY comm_payouts_insert ON commission_payouts FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY comm_payouts_update ON commission_payouts FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY comm_payouts_delete ON commission_payouts FOR DELETE TO service_role USING (true);

-- commission_clawbacks
CREATE POLICY comm_clawbacks_select ON commission_clawbacks FOR SELECT TO service_role USING (true);
CREATE POLICY comm_clawbacks_insert ON commission_clawbacks FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY comm_clawbacks_update ON commission_clawbacks FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY comm_clawbacks_delete ON commission_clawbacks FOR DELETE TO service_role USING (true);

-- anti_kickback_patterns
CREATE POLICY antikickback_select ON anti_kickback_patterns FOR SELECT TO service_role USING (true);
CREATE POLICY antikickback_insert ON anti_kickback_patterns FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY antikickback_update ON anti_kickback_patterns FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY antikickback_delete ON anti_kickback_patterns FOR DELETE TO service_role USING (true);

-- aml_rules
CREATE POLICY aml_rules_select ON aml_rules FOR SELECT TO service_role USING (true);
CREATE POLICY aml_rules_insert ON aml_rules FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY aml_rules_update ON aml_rules FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY aml_rules_delete ON aml_rules FOR DELETE TO service_role USING (true);

-- aml_alerts
CREATE POLICY aml_alerts_select ON aml_alerts FOR SELECT TO service_role USING (true);
CREATE POLICY aml_alerts_insert ON aml_alerts FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY aml_alerts_update ON aml_alerts FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY aml_alerts_delete ON aml_alerts FOR DELETE TO service_role USING (true);

-- aml_cases
CREATE POLICY aml_cases_select ON aml_cases FOR SELECT TO service_role USING (true);
CREATE POLICY aml_cases_insert ON aml_cases FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY aml_cases_update ON aml_cases FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY aml_cases_delete ON aml_cases FOR DELETE TO service_role USING (true);

-- audit_log（既有舊表）
CREATE POLICY audit_log_select ON audit_log FOR SELECT TO service_role USING (true);
CREATE POLICY audit_log_insert ON audit_log FOR INSERT TO service_role WITH CHECK (true);
