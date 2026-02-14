-- ============================================================
-- Migration 018a: 新增 regulator 角色到 app_role enum
-- 高於 admin，唯一能設定政府級約束規則的角色
-- Migration: 20260212120837_add_regulator_role
-- ============================================================
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'regulator';
