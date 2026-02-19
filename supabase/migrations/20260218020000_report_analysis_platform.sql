-- ============================================================
-- 049: Report Analysis Platform
-- 丟檔案 → AI出報告 → 點數付費 → 下載
-- Patent 115100981 — 世界定義約束法用於AI推理
-- ============================================================

-- Analysis Reports
CREATE TABLE IF NOT EXISTS analysis_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text,
  file_size bigint DEFAULT 0,
  text_content text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  industry_l1 text,
  industry_l2 text,
  industry_l3 text,
  industry_l4 text,
  cross_country jsonb DEFAULT '{}',
  ai_summary text,
  ai_full_report jsonb DEFAULT '{}',
  risk_score numeric(5,2) DEFAULT 0,
  compliance_flags jsonb DEFAULT '[]',
  inference_trail jsonb DEFAULT '[]',
  points_cost integer DEFAULT 50,
  is_paid boolean DEFAULT false,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_reports" ON analysis_reports
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reports_user ON analysis_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON analysis_reports(status);

-- User Credits
CREATE TABLE IF NOT EXISTS user_credits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance integer DEFAULT 100,
  total_purchased integer DEFAULT 0,
  total_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_credits" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Credit Transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text CHECK (type IN ('bonus', 'purchase', 'use', 'refund')),
  reference_id uuid,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_txns" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_credit_txns_user ON credit_transactions(user_id);
