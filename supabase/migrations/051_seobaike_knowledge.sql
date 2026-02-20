-- ═══════════════════════════════════════════════════════════════
-- Migration 051: seobaike_knowledge — 腳本強制注入知識庫
-- MCP 主權 OS | 台灣專利 115100981 | 小路光有限公司 | 許竣翔
-- ═══════════════════════════════════════════════════════════════

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 知識庫主表 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seobaike_knowledge (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  content     TEXT    NOT NULL,           -- 腳本原文
  category    TEXT    NOT NULL DEFAULT 'general', -- 分類標籤
  file_name   TEXT,                       -- 來源檔案
  section     TEXT,                       -- 章節名稱
  embedding   VECTOR(1024),               -- NVIDIA nv-embedqa-e5-v5 = 1024 dims
  is_embedded BOOLEAN DEFAULT FALSE,      -- 是否已向量化
  priority    INT     DEFAULT 5,          -- 優先權 (1=最高, 10=最低)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 向量索引（IVFFlat — 快速相似搜尋）
CREATE INDEX IF NOT EXISTS seobaike_knowledge_vector_idx
  ON public.seobaike_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 一般索引
CREATE INDEX IF NOT EXISTS seobaike_knowledge_category_idx
  ON public.seobaike_knowledge (category);

CREATE INDEX IF NOT EXISTS seobaike_knowledge_embedded_idx
  ON public.seobaike_knowledge (is_embedded);

-- RLS
ALTER TABLE public.seobaike_knowledge ENABLE ROW LEVEL SECURITY;

-- Service role 可完整操作
CREATE POLICY "service_full_access" ON public.seobaike_knowledge
  FOR ALL TO service_role USING (true);

-- Anon 只能讀（Gateway 用 anon key 查詢）
CREATE POLICY "anon_read" ON public.seobaike_knowledge
  FOR SELECT TO anon USING (true);

-- Authenticated 可讀
CREATE POLICY "auth_read" ON public.seobaike_knowledge
  FOR SELECT TO authenticated USING (true);

-- ─── match_knowledge RPC ──────────────────────────────────────────
-- 用法：supabase.rpc('match_knowledge', { query_embedding, match_count })
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding  VECTOR(1024),
  match_count      INT     DEFAULT 5,
  match_threshold  FLOAT   DEFAULT 0.35,
  filter_category  TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  content     TEXT,
  category    TEXT,
  file_name   TEXT,
  section     TEXT,
  similarity  FLOAT,
  priority    INT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    k.id,
    k.content,
    k.category,
    k.file_name,
    k.section,
    1 - (k.embedding <=> query_embedding) AS similarity,
    k.priority
  FROM public.seobaike_knowledge k
  WHERE
    k.is_embedded = TRUE
    AND 1 - (k.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR k.category = filter_category)
  ORDER BY
    k.priority ASC,
    k.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- ─── 新增知識便捷函數 ──────────────────────────────────────────────
-- 用法：SELECT add_knowledge('內容', '分類')
CREATE OR REPLACE FUNCTION public.add_knowledge(
  p_content    TEXT,
  p_category   TEXT DEFAULT 'general',
  p_file_name  TEXT DEFAULT NULL,
  p_section    TEXT DEFAULT NULL,
  p_priority   INT  DEFAULT 5
)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.seobaike_knowledge
    (content, category, file_name, section, priority, is_embedded)
  VALUES
    (p_content, p_category, p_file_name, p_section, p_priority, FALSE)
  RETURNING id;
$$;

-- 完成
COMMENT ON TABLE public.seobaike_knowledge IS
  'MCP 主權 OS 腳本知識庫 — Gateway 強制注入層 | 專利 115100981';
