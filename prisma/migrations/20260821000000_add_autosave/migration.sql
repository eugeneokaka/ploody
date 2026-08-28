-- Add autosave support to notes (missing from prod)
ALTER TABLE "note" ADD COLUMN "autosaveEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "note" ADD COLUMN "autosaveVersionId" TEXT;

-- Unique index for autosave version
CREATE UNIQUE INDEX "note_autosaveVersionId_key" ON "note"("autosaveVersionId");

-- Foreign key to the autosave version
ALTER TABLE "note" ADD CONSTRAINT "note_autosaveVersionId_fkey" FOREIGN KEY ("autosaveVersionId") REFERENCES "note_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
