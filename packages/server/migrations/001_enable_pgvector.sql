-- Migration: Enable pgvector extension and create knowledge base tables
-- Run this in Supabase SQL Editor or via migration tool

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create knowledge documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- OpenAI/Tongyi Embedding dimension
  metadata JSONB DEFAULT '{}',
  source_type TEXT,  -- 'pdf', 'txt', 'md', 'web'
  source_url TEXT,
  workspace_id TEXT,  -- Optional: 关联到特定工作空间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create vector index for similarity search
-- HNSW (Hierarchical Navigable Small World) is more accurate than IVFFlat
CREATE INDEX IF NOT EXISTS knowledge_documents_embedding_idx
  ON knowledge_documents
  USING hnsw (embedding vector_cosine_ops);

-- 4. Create text index for hybrid search
CREATE INDEX IF NOT EXISTS knowledge_documents_content_idx
  ON knowledge_documents
  USING gin (to_tsvector('english', content));

-- 5. Create document chunks table (for long documents)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create vector index for chunks
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 7. Create agent messages table (for multi-agent communication)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  conversation_id TEXT,
  sender TEXT NOT NULL,  -- 'market_agent', 'compliance_agent', 'orchestrator', etc.
  receiver TEXT,  -- target agent or 'broadcast'
  message_type TEXT NOT NULL,  -- 'task', 'result', 'question', 'answer'
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create index for agent messages
CREATE INDEX IF NOT EXISTS agent_messages_workspace_idx
  ON agent_messages(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_messages_conversation_idx
  ON agent_messages(conversation_id, created_at);

-- 9. Create RAG retrieval logs table (for analytics)
CREATE TABLE IF NOT EXISTS rag_retrieval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  query_embedding VECTOR(1536),
  retrieved_document_ids UUID[],
  similarity_scores FLOAT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create function for automatic updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger for knowledge_documents
CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 12. Create RLS (Row Level Security) policies if needed
-- ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their own documents"
--   ON knowledge_documents FOR SELECT
--   USING (workspace_id = current_setting('app.current_workspace_id', true));

-- 13. Create helper function for cosine similarity search
CREATE OR REPLACE FUNCTION match_knowledge_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5,
  filter_workspace_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kd.id,
    kd.title,
    kd.content,
    1 - (kd.embedding <=> query_embedding) AS similarity,
    kd.metadata
  FROM knowledge_documents kd
  WHERE
    (filter_workspace_id IS NULL OR kd.workspace_id = filter_workspace_id)
    AND 1 - (kd.embedding <=> query_embedding) > match_threshold
  ORDER BY kd.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- 14. Create helper function for chunk search
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity,
    kc.metadata
  FROM knowledge_chunks kc
  WHERE 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
