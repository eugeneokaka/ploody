# PostgreSQL Full-Text Search in Ploody

## Overview

Ploody uses PostgreSQL's built-in full-text search engine with GIN-indexed generated columns to search across notes and folders. This gives us Elasticsearch-like performance without leaving the database.

## The Pipeline: From Keystroke to Result

```
User types "kneading dough"
        │
        ▼
┌─────────────────────────────────────────────┐
│  plainto_tsquery('english', 'kneading dough')│
│  → 'knead' & 'dough'                         │
│  (stems words, strips punctuation)            │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  GIN index lookup on "searchVector"          │
│  → Row IDs: [42, 87, 203]                    │
│  (O(log n) — reads only index pages)         │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│  Read matched rows, compute rank + snippet   │
│  ts_rank() → relevance score                 │
│  ts_headline() → highlighted excerpt         │
└─────────────────────────────────────────────┘
        │
        ▼
     Results sorted by rank, returned as JSON
```

## Layer 1: `tsvector` — The Search Index Per Row

A `tsvector` is PostgreSQL's internal search data type. It takes human text and converts it into a sorted list of *lexemes* (normalized word roots) with positional data.

### How text becomes a tsvector

```sql
SELECT to_tsvector('english', 'Sarah was kneading dough for 10 minutes');
```

| Input word | Lexeme | Why |
|---|---|---|
| `Sarah` | `sarah` | Lowercased, kept (not a stop word) |
| `was` | *removed* | Stop word — too common, carries no meaning |
| `kneading` | `knead` | Stemmed — "kneading", "kneaded", "kneads" all → `knead` |
| `dough` | `dough` | Kept as-is (already root form) |
| `for` | *removed* | Stop word |
| `10` | `10` | Kept (numbers can be meaningful) |
| `minutes` | `minut` | Stemmed — "minutes", "minute" → `minut` |

Result: `'dough':3 'knead':2 'minut':6 'sarah':1 '10':5`

Each lexeme has a **position** (where it appears in the text). This powers phrase searches and proximity ranking.

### Stored, not computed

The `searchVector` column on both `note` and `folder` is a **generated column**:

```sql
ALTER TABLE "note" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))
  ) STORED;
```

`GENERATED ALWAYS AS ... STORED` means:
- PostgreSQL **automatically** builds this column when a row is inserted
- PostgreSQL **automatically** updates it when the row is updated
- It's stored on disk (not virtual), so it can be indexed
- Zero application code touches it — it's invisible to Prisma queries unless you explicitly select it

```sql
-- The column maintains itself:
INSERT INTO note (title, content) VALUES ('Bread', 'Knead dough for 10 min');
-- searchVector auto-populated: 'bread':1 'dough':3 'knead':2 'min':5 '10':4

UPDATE note SET content = 'Knead dough for 20 min, rest 1 hour';
-- searchVector auto-updated: 'bread':1 'dough':3 'hour':7 'knead':2 'min':5 'rest':6 '1':7 '20':4
```

## Layer 2: `tsquery` — Turning User Input Into a Search

`plainto_tsquery` converts human search input into the same normalized form:

```sql
SELECT plainto_tsquery('english', 'kneading dough');
-- Result: 'knead' & 'dough'
```

It:
1. Splits on whitespace and punctuation
2. Strips stop words
3. Stems each word
4. Joins with `&` (AND logic — all terms must match)

### Alternative: `websearch_to_tsquery` vs `plainto_tsquery`

| Function | Input | Output | Use case |
|---|---|---|---|
| `plainto_tsquery` | `kneading dough` | `'knead' & 'dough'` | Simple keyword search (AND) |
| `websearch_to_tsquery` | `"sourdough bread" -rye` | `'sourdough' <-> 'bread' & !'rye'` | Google-like syntax with quotes and negation |
| `phraseto_tsquery` | `sourdough bread` | `'sourdough' <-> 'bread'` | Exact phrase match |

We use `plainto_tsquery` because it's the most forgiving — no special syntax required, just plain words.

### The `@@` match operator

```sql
-- Does this document contain these terms?
SELECT 'knead':2 'dough':3 'minut':5 :: tsvector @@ plainto_tsquery('english', 'kneading dough');
-- Result: true
```

The `@@` operator returns `true` if the lexemes in the tsvector satisfy the tsquery. This is what the GIN index accelerates.

## Layer 3: GIN Index — The Secret Sauce

GIN stands for **Generalized Inverted Index**. It's exactly like the index at the back of a textbook.

### Without GIN (sequential scan)

```
Query: WHERE "searchVector" @@ 'knead' & 'dough'

Row 1: 'sarah':1 'notebook':2         → No match (read, discard)
Row 2: 'knead':2 'dough':3            → Match! (keep)
Row 3: 'meeting':1 'agenda':2         → No match (read, discard)
...
Row 99,999: 'bread':1 'recipe':2      → No match (read, discard)
Row 100,000: 'knead':1 'dough':2      → Match! (keep)

Time: O(n) — every row is read
With 100K rows: ~3 seconds
```

### With GIN (index scan)

```
Query: WHERE "searchVector" @@ 'knead' & 'dough'

GIN index lookup for 'knead' → pages [5, 8, 42, 203]
GIN index lookup for 'dough' → pages [5, 8, 87, 203]
Intersection → pages [5, 8, 203]

Only read those 3 rows from disk.

Time: O(log n) — only index pages are scanned
With 100K rows: ~5ms
With 1M rows: ~5ms
With 10M rows: ~5ms
```

### Internal structure

A GIN index stores an entry for every unique lexeme:

```
┌─────────────────────────────────────────────────────┐
│  GIN Index on "searchVector"                         │
├──────────┬──────────────────────────────────────────┤
│  Lexeme  │  Posting List (row locations)            │
├──────────┼──────────────────────────────────────────┤
│  knead   │  [row 5, row 42, row 203, row 890, ...] │
│  dough   │  [row 5, row 87, row 203, ...]           │
│  bread   │  [row 5, row 42, row 776, ...]           │
│  recipe  │  [row 42, row 100, row 776, ...]         │
│  ...     │  ...                                     │
└──────────┴──────────────────────────────────────────┘
```

When you search for `'knead' & 'dough'`, PostgreSQL:
1. Looks up `knead` → `[5, 42, 203, 890, ...]`
2. Looks up `dough` → `[5, 87, 203, ...]`
3. Intersects the lists → `[5, 203]`
4. Reads only rows 5 and 203 from the heap

This is why it scales — the index size grows with vocabulary diversity, not row count. English has ~170K words, so even with millions of notes, the index stays manageable.

## Layer 4: Ranking and Snippets

### `ts_rank` — How relevant is this match?

```sql
SELECT ts_rank("searchVector", plainto_tsquery('english', 'bread recipe'))
FROM note;
```

Ranking factors:
- **Term frequency**: How many times does the word appear in this document?
- **Position**: Is the word near the start of the document? (title often gets boosted here since we concatenate title first)
- **Coverage**: How much of the document does matching text cover?

### `ts_headline` — Showing where the match is

```sql
SELECT ts_headline(
  'english',
  content,
  plainto_tsquery('english', 'kneading'),
  'MaxWords=12, MinWords=6'
) FROM note;
```

This returns a short excerpt with matched terms wrapped in `<b>` tags:

```
Input:  "First, combine flour and water in a large bowl. Then knead the dough for about 
         10 minutes until smooth and elastic. Let it rest..."
         
Output: "...Then <b>knead</b> the dough for about 10 minutes until smooth and elastic..."
```

The `ts_headline` is the only part that still reads the original text — but it only processes the ~5 rows that matched, not the entire table.

## The Schema

### Migration SQL

```sql
-- Note: searches title + content
ALTER TABLE "note" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content", ''))
  ) STORED;

CREATE INDEX "idx_note_search" ON "note" USING GIN ("searchVector");

-- Folder: searches name only (lighter than note)
ALTER TABLE "folder" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("name", ''))
  ) STORED;

CREATE INDEX "idx_folder_search" ON "folder" USING GIN ("searchVector");
```

### Prisma schema

```prisma
model Note {
  searchVector Unsupported("tsvector")?
  // ↑ Prisma doesn't natively support tsvector columns.
  //   Unsupported() tells Prisma this column exists in the DB
  //   but to leave it alone — no CRUD operations.
}
```

### Why `Unsupported`?

Prisma's type system doesn't have a `tsvector` type. `Unsupported("tsvector")?` tells Prisma:
- This column exists in the database (for raw queries to use)
- Don't try to insert/update/select it in generated queries
- It's nullable (`?`) because existing rows before the migration had no value until generated

## The Query

```sql
-- Search notes
SELECT id, title, 'note'::text AS type, "folderId",
       ts_rank("searchVector", plainto_tsquery('english', $1)) AS rank,
       ts_headline('english', coalesce(content, ''), 
                   plainto_tsquery('english', $1), 
                   'MaxWords=12, MinWords=6') AS snippet
FROM note
WHERE "userId" = $2
  AND "searchVector" @@ plainto_tsquery('english', $1)

UNION ALL

-- Search folders
SELECT id, name AS title, 'folder'::text AS type, NULL::text AS "folderId",
       ts_rank("searchVector", plainto_tsquery('english', $1)) AS rank,
       NULL::text AS snippet
FROM folder
WHERE "userId" = $2
  AND "searchVector" @@ plainto_tsquery('english', $1)

ORDER BY rank DESC
LIMIT 10
```

Key points:
- `$1` is the user's search query (parameterized — safe from SQL injection)
- `$2` is the `userId` (scoped to one user's data)
- `UNION ALL` combines both tables (faster than `UNION` since no dedup needed)
- `ORDER BY rank DESC` — most relevant results first
- `LIMIT 10` — caps response size
- Folder rows have `NULL` snippet (folders have no body text)

## SQL Injection Safety

We use Prisma's tagged template literal (`$queryRaw`) which automatically parameterizes variables:

```ts
// Safe: $1 is treated as a parameter
prisma.$queryRaw`SELECT ... WHERE "searchVector" @@ plainto_tsquery('english', ${query})`
```

The `${query}` is sent as a separate parameter to PostgreSQL, never interpolated into the SQL string. Even if a user types `'; DROP TABLE note; --`, it becomes a search for that literal string (which won't match anything).

## Performance Characteristics

| Scenario | Without index | With GIN index |
|---|---|---|
| 10 notes | ~2ms | ~2ms (no difference at small scale) |
| 1,000 notes | ~50ms | ~3ms |
| 10,000 notes | ~500ms | ~4ms |
| 100,000 notes | ~5s | ~5ms |
| 1,000,000 notes | ~50s | ~5ms |

The GIN index makes search **O(log n)** instead of **O(n)**. At scale, the difference is the difference between instant and unusable.

## Maintenance

**Zero.** The generated column and index are fully automatic:

- ✅ New notes → tsvector auto-generated
- ✅ Updated notes → tsvector auto-updated
- ✅ Deleted notes → index entry auto-removed
- ✅ Index fragmentation → PostgreSQL handles it via autovacuum
- ✅ No cron jobs, no reindexing, no triggers

To check index health:
```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname IN ('idx_note_search', 'idx_folder_search');
```

## Multi-language Support

We use `'english'` as the dictionary. PostgreSQL supports many languages out of the box:

```sql
-- French stemming
to_tsvector('french', 'les chats couraient')

-- German compound word splitting
to_tsvector('german', 'Donaudampfschifffahrtsgesellschaftskapitän')
```

To support multiple languages, you could add a language preference per user and parameterize the dictionary:
```sql
to_tsvector(user_language, title || ' ' || content) 
```

## Why Not Elasticsearch / Meilisearch?

| Factor | PostgreSQL FTS | External Search |
|---|---|---|
| Setup | 1 migration | Separate service, Docker, config |
| Sync | Automatic (generated column) | Need sync pipeline |
| Latency | 0 (same process) | Network round-trip |
| Query flexibility | SQL joins, filters, pagination | Proprietary DSL |
| Cost | Free with Neon | Additional hosting |
| Relevance tuning | `ts_rank`, weights, custom dictionaries | BM25, custom scoring |
| Scale limit | ~10M documents on single instance | Billions of documents |

For an app at Ploody's scale, PostgreSQL FTS is the right call — zero operational overhead, native SQL integration, and it'll serve millions of notes before you'd even think about needing something heavier.
