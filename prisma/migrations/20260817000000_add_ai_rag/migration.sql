-- Enable pgvector for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for note chunks + their embeddings
CREATE TABLE "note_chunk" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_chunk_pkey" PRIMARY KEY ("id")
);

-- Flag to enable/disable AI indexing per note
ALTER TABLE "note" ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Indexes
CREATE INDEX "note_chunk_noteId_idx" ON "note_chunk"("noteId");
CREATE INDEX "note_chunk_embedding_idx" ON "note_chunk" USING hnsw ("embedding" vector_cosine_ops);

-- Foreign key
ALTER TABLE "note_chunk" ADD CONSTRAINT "note_chunk_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
