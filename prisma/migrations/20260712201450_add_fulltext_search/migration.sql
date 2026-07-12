-- Add generated tsvector columns for full-text search
ALTER TABLE "note" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))
  ) STORED;

ALTER TABLE "folder" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("name", ''))
  ) STORED;

-- GIN indexes for lightning-fast full-text search
CREATE INDEX "idx_note_search" ON "note" USING GIN ("searchVector");
CREATE INDEX "idx_folder_search" ON "folder" USING GIN ("searchVector");
