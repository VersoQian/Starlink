CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" TEXT PRIMARY KEY,
  "kb_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "title" TEXT,
  "chunk_index" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "embedding" JSONB NOT NULL,
  "token_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_chunks_kb_id_fkey"
    FOREIGN KEY ("kb_id") REFERENCES "KnowledgeBase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_chunks_kb_id_source_type_source_id_chunk_index_key"
  ON "knowledge_chunks"("kb_id", "source_type", "source_id", "chunk_index");

CREATE INDEX IF NOT EXISTS "knowledge_chunks_kb_id_idx"
  ON "knowledge_chunks"("kb_id");

CREATE INDEX IF NOT EXISTS "knowledge_chunks_source_id_idx"
  ON "knowledge_chunks"("source_id");
