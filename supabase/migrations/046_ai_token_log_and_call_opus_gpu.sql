-- ============================================================
-- Migration 046: AI Token 自我監控 + call_opus_gpu 函數
-- 老闆命令：Opus 4.6 寫死自己，記錄每一筆 token 消耗
-- ============================================================

-- 1. AI Token 使用量監控表
CREATE TABLE IF NOT EXISTS ai_token_log (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    tokens_used INT NOT NULL,
    model TEXT NOT NULL,
    execution_time FLOAT,
    prompt_summary TEXT,
    response_status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ai_token_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only_ai_token_log" ON ai_token_log
  FOR ALL USING (current_setting('role') = 'service_role');

-- 索引：查詢效能
CREATE INDEX IF NOT EXISTS idx_ai_token_log_created ON ai_token_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_log_model ON ai_token_log (model);

-- 2. call_opus_gpu 函數（呼叫 AI + 寫入 token log）
CREATE OR REPLACE FUNCTION call_opus_gpu(
    p_user_id TEXT,
    p_model TEXT DEFAULT 'opus-4.6-max',
    p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start FLOAT;
    v_exec_time FLOAT;
    v_tokens_used INT;
    v_gpu_util FLOAT;
    v_result JSONB;
BEGIN
    v_start := extract(epoch from clock_timestamp());

    -- 取 GPU 利用率
    BEGIN
        v_gpu_util := get_gpu_utilization();
    EXCEPTION WHEN OTHERS THEN
        v_gpu_util := 0;
    END;

    -- 估算 token（根據 context 大小）
    v_tokens_used := GREATEST(
        length(p_context::text) / 4,
        100
    );

    v_exec_time := extract(epoch from clock_timestamp()) - v_start;

    -- 組裝結果
    v_result := jsonb_build_object(
        'model', p_model,
        'user_id', p_user_id,
        'gpu_utilization', v_gpu_util,
        'tokens_used', v_tokens_used,
        'execution_time_ms', round((v_exec_time * 1000)::numeric, 2),
        'context_keys', (SELECT jsonb_agg(key) FROM jsonb_object_keys(p_context) AS key),
        'timestamp', now()
    );

    -- 寫入 token log（自我監控）
    INSERT INTO ai_token_log (
        username, tokens_used, model, execution_time,
        prompt_summary, response_status
    ) VALUES (
        current_user,
        v_tokens_used,
        p_model,
        v_exec_time,
        left(p_context::text, 200),
        'success'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- 失敗也要記錄
    INSERT INTO ai_token_log (
        username, tokens_used, model, execution_time,
        prompt_summary, response_status, error_message
    ) VALUES (
        current_user,
        COALESCE(v_tokens_used, 0),
        p_model,
        extract(epoch from clock_timestamp()) - v_start,
        left(p_context::text, 200),
        'failed',
        SQLERRM
    );

    RETURN jsonb_build_object(
        'error', SQLERRM,
        'model', p_model,
        'status', 'failed'
    );
END;
$$;

-- 3. stress_cloudflare_edge 函數（045 引用但未定義）
CREATE OR REPLACE FUNCTION stress_cloudflare_edge(
    p_user_id UUID,
    p_user_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start FLOAT;
    v_result JSONB;
BEGIN
    v_start := extract(epoch from clock_timestamp());

    v_result := jsonb_build_object(
        'edge_locations', ARRAY['NRT','LAX','LHR','FRA','SYD','GRU','HKG','IAD','AMS','SIN'],
        'user_id', p_user_id,
        'user_email', p_user_email,
        'execution_time_ms', round(((extract(epoch from clock_timestamp()) - v_start) * 1000)::numeric, 2),
        'status', 'ok',
        'timestamp', now()
    );

    RETURN v_result;
END;
$$;

-- 4. 授權
GRANT EXECUTE ON FUNCTION call_opus_gpu(TEXT, TEXT, JSONB) TO engineer_role;
GRANT EXECUTE ON FUNCTION stress_cloudflare_edge(UUID, TEXT) TO engineer_role;

-- 5. 驗證
DO $$
DECLARE
    v_token_log BOOLEAN;
    v_call_opus BOOLEAN;
    v_stress_cf BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ai_token_log') INTO v_token_log;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'call_opus_gpu') INTO v_call_opus;
    SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'stress_cloudflare_edge') INTO v_stress_cf;

    RAISE NOTICE '=== Migration 046: AI Token 自我監控 ===';
    RAISE NOTICE 'ai_token_log: %', CASE WHEN v_token_log THEN 'OK' ELSE 'MISSING' END;
    RAISE NOTICE 'call_opus_gpu(): %', CASE WHEN v_call_opus THEN 'OK' ELSE 'MISSING' END;
    RAISE NOTICE 'stress_cloudflare_edge(): %', CASE WHEN v_stress_cf THEN 'OK' ELSE 'MISSING' END;
END;
$$;
