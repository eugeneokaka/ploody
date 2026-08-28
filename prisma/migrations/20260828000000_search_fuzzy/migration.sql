-- Search: PostgreSQL FTS + fuzzy (pg_trgm) fallback with weighted ranking.
--
-- Rebuilds note search from extracted plain text (instead of raw TipTap JSON)
-- and adds fuzzy typo-tolerance on top of exact FTS.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Plain-text column for search (populated by trigger, see below)
ALTER TABLE "note_version" ADD COLUMN IF NOT EXISTS "searchText" TEXT NOT NULL DEFAULT '';

-- 3. Extract visible text from a TipTap/ProseMirror JSON document.
--    Walks every nested "content" array and collects all "text" values.
CREATE OR REPLACE FUNCTION public.extract_tiptap_text(content text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text;
BEGIN
  IF content IS NULL OR btrim(content) = '' THEN
    RETURN '';
  END IF;
  BEGIN
    WITH RECURSIVE walk(node) AS (
      SELECT content::jsonb
      UNION ALL
      SELECT j.value
      FROM walk w
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(w.node -> 'content') = 'array'
             THEN w.node -> 'content' ELSE '[]'::jsonb END
      ) AS j(value)
    )
    SELECT COALESCE(string_agg(node ->> 'text', ' '), '')
    INTO result
    FROM walk
    WHERE node ? 'text'
      AND node ->> 'text' IS NOT NULL
      AND btrim(node ->> 'text') <> '';
  EXCEPTION WHEN others THEN
    result := regexp_replace(content, '\s+', ' ', 'g');
  END;
  RETURN result;
END;
$$;

-- 4. Keep note_version.searchText in sync with content
CREATE OR REPLACE FUNCTION public.compute_note_version_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."searchText" := public.extract_tiptap_text(NEW.content);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_note_version_search_text ON "note_version";
CREATE TRIGGER trigger_note_version_search_text
BEFORE INSERT OR UPDATE OF content ON "note_version"
FOR EACH ROW EXECUTE FUNCTION public.compute_note_version_search_text();

-- 5. Rebuild note.searchVector as a weighted tsvector
--    (title 'A' weight, extracted body 'B' weight) so title matches rank higher.
CREATE OR REPLACE FUNCTION public.update_note_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'note_version' THEN
    UPDATE "note" n
    SET "searchVector" =
      setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(NEW."searchText", '')), 'B')
    WHERE n."currentVersionId" = NEW.id;
  ELSIF TG_TABLE_NAME = 'note' THEN
    UPDATE "note" n
    SET "searchVector" =
      setweight(to_tsvector('english', coalesce(nv.title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(nv."searchText", '')), 'B')
    FROM "note_version" nv
    WHERE n.id = NEW.id AND n."currentVersionId" = nv.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Keep folder.searchVector in sync with its name
CREATE OR REPLACE FUNCTION public.update_folder_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', coalesce(NEW.name, ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_folder_search_vector ON "folder";
CREATE TRIGGER trigger_folder_search_vector
BEFORE INSERT OR UPDATE OF name ON "folder"
FOR EACH ROW EXECUTE FUNCTION public.update_folder_search_vector();

-- 7. Backfill existing data
UPDATE "note_version" SET "searchText" = public.extract_tiptap_text(content);

UPDATE "note" n
SET "searchVector" =
  setweight(to_tsvector('english', coalesce(nv.title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(nv."searchText", '')), 'B')
FROM "note_version" nv
WHERE n."currentVersionId" = nv.id;

UPDATE "folder" SET "searchVector" = to_tsvector('english', coalesce(name, ''));

-- 8. Trigram indexes for fuzzy search
CREATE INDEX IF NOT EXISTS idx_note_version_search_text_trgm ON "note_version" USING gin ("searchText" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_note_version_title_trgm ON "note_version" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_folder_name_trgm ON "folder" USING gin ("name" gin_trgm_ops);
