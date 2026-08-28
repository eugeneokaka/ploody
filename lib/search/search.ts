import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const FUZZY_THRESHOLD = 0.4;
const CANDIDATE_LIMIT = 25;
const RESULT_LIMIT = 10;

// Ranking weights (see plan): term coverage dominates, ts_rank shapes the rest.
const COVERAGE_WEIGHT = 0.6;
const RANK_WEIGHT = 0.4;
const FUZZY_TERM_WEIGHT = 0.6;

export type SearchHit = {
  id: string;
  type: "note" | "folder";
  title: string;
  folderId: string | null;
  snippet: string | null;
};

export type PublicHit = {
  id: string;
  title: string;
  snippet: string | null;
};

type ExactRow = {
  id: string;
  title: string;
  folderId: string | null;
  type: "note" | "folder";
  rank: number;
  snippet: string | null;
  exact_matched: number;
};

type FuzzyRow = {
  id: string;
  title: string;
  folderId: string | null;
  type: "note" | "folder";
  fuzzy_matches: number;
};

type LexRow = { lexeme: string };

type Scored = {
  id: string;
  type: "note" | "folder";
  title: string;
  folderId: string | null;
  snippet: string | null;
  exactMatched: number;
  fuzzyMatched: number;
  rank: number;
};

function normalizeQuery(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s]+/gu, " ").replace(/\s+/g, " ").trim();
}

function buildOrTsquery(query: string): Prisma.Sql {
  const terms = query.split(/\s+/).filter(Boolean);
  const parts = terms.map((t) => Prisma.sql`plainto_tsquery('english', ${t})`);
  return Prisma.join(parts, " || ");
}

async function getLexemes(query: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<LexRow[]>`
    SELECT DISTINCT unnest(tsvector_to_array(strip(to_tsvector('english', ${query})))) AS lexeme
  `;
  return rows.map((r) => r.lexeme);
}

async function exactNotes(
  noteFilter: Prisma.Sql,
  tsquery: Prisma.Sql,
  query: string
): Promise<ExactRow[]> {
  return prisma.$queryRaw<ExactRow[]>`
    SELECT n.id, nv.title, n."folderId", 'note'::text AS type,
           ts_rank(n."searchVector", (${tsquery}), 32)::float8 AS rank,
           ts_headline('english', nv."searchText", (${tsquery}), 'MaxWords=20, MinWords=8') AS snippet,
           (SELECT count(*) FROM unnest(tsvector_to_array(strip(to_tsvector('english', ${query})))) AS lx
             WHERE n."searchVector" @@ plainto_tsquery('english', lx))::int AS exact_matched
    FROM note n
    JOIN note_version nv ON n."currentVersionId" = nv.id
    WHERE ${noteFilter}
      AND n."searchVector" @@ (${tsquery})
    LIMIT ${CANDIDATE_LIMIT}
  `;
}

async function exactFolders(
  folderFilter: Prisma.Sql,
  tsquery: Prisma.Sql,
  query: string
): Promise<ExactRow[]> {
  return prisma.$queryRaw<ExactRow[]>`
    SELECT id, name AS title, NULL::text AS "folderId", 'folder'::text AS type,
           ts_rank("searchVector", (${tsquery}), 32)::float8 AS rank,
           NULL::text AS snippet,
           (SELECT count(*) FROM unnest(tsvector_to_array(strip(to_tsvector('english', ${query})))) AS lx
             WHERE "searchVector" @@ plainto_tsquery('english', lx))::int AS exact_matched
    FROM folder
    WHERE ${folderFilter}
      AND "searchVector" @@ (${tsquery})
    LIMIT ${CANDIDATE_LIMIT}
  `;
}

async function unmatchedTerms(
  noteFilter: Prisma.Sql,
  folderFilter: Prisma.Sql | null,
  query: string
): Promise<string[]> {
  const rows = await prisma.$queryRaw<LexRow[]>`
    SELECT t.term AS lexeme
    FROM unnest(tsvector_to_array(strip(to_tsvector('english', ${query})))) AS t(term)
    WHERE NOT EXISTS (
      SELECT 1 FROM note n
      JOIN note_version nv ON n."currentVersionId" = nv.id
      WHERE ${noteFilter}
        AND to_tsvector('english', nv.title || ' ' || nv."searchText") @@ plainto_tsquery('english', t.term)
    )
    ${
      folderFilter
        ? Prisma.sql`AND NOT EXISTS (
      SELECT 1 FROM folder f
      WHERE ${folderFilter}
        AND to_tsvector('english', f.name) @@ plainto_tsquery('english', t.term)
    )`
        : Prisma.empty
    }
  `;
  return rows.map((r) => r.lexeme);
}

async function fuzzyNotes(
  noteFilter: Prisma.Sql,
  unmatched: string[]
): Promise<FuzzyRow[]> {
  if (unmatched.length === 0) return [];
  const cases = unmatched.map(
    (t) =>
      Prisma.sql`CASE WHEN (word_similarity(${t}, nv."searchText") > ${FUZZY_THRESHOLD} OR word_similarity(${t}, nv.title) > ${FUZZY_THRESHOLD}) THEN 1 ELSE 0 END`
  );
  const sum = Prisma.join(cases, " + ");
  return prisma.$queryRaw<FuzzyRow[]>`
    SELECT n.id, nv.title, n."folderId", 'note'::text AS type,
           (${sum})::int AS fuzzy_matches
    FROM note n
    JOIN note_version nv ON n."currentVersionId" = nv.id
    WHERE ${noteFilter}
      AND (${sum}) > 0
    LIMIT ${CANDIDATE_LIMIT}
  `;
}

async function fuzzyFolders(
  folderFilter: Prisma.Sql,
  unmatched: string[]
): Promise<FuzzyRow[]> {
  if (unmatched.length === 0) return [];
  const cases = unmatched.map(
    (t) =>
      Prisma.sql`CASE WHEN word_similarity(${t}, name) > ${FUZZY_THRESHOLD} THEN 1 ELSE 0 END`
  );
  const sum = Prisma.join(cases, " + ");
  return prisma.$queryRaw<FuzzyRow[]>`
    SELECT id, name AS title, NULL::text AS "folderId", 'folder'::text AS type,
           (${sum})::int AS fuzzy_matches
    FROM folder
    WHERE ${folderFilter}
      AND (${sum}) > 0
    LIMIT ${CANDIDATE_LIMIT}
  `;
}

function mergeAndRank(
  lexemes: string[],
  exact: ExactRow[],
  fuzzy: FuzzyRow[]
): SearchHit[] {
  const total = lexemes.length;
  const map = new Map<string, Scored>();

  for (const r of exact) {
    const key = `${r.type}:${r.id}`;
    map.set(key, {
      id: r.id,
      type: r.type,
      title: r.title,
      folderId: r.folderId,
      snippet: r.snippet,
      exactMatched: Number(r.exact_matched),
      fuzzyMatched: 0,
      rank: Number(r.rank),
    });
  }

  for (const f of fuzzy) {
    const key = `${f.type}:${f.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.fuzzyMatched = Math.max(existing.fuzzyMatched, Number(f.fuzzy_matches));
    } else {
      map.set(key, {
        id: f.id,
        type: f.type,
        title: f.title,
        folderId: f.folderId,
        snippet: null,
        exactMatched: 0,
        fuzzyMatched: Number(f.fuzzy_matches),
        rank: 0,
      });
    }
  }

  const scored = Array.from(map.values()).map((s) => {
    const coverage = (s.exactMatched + FUZZY_TERM_WEIGHT * s.fuzzyMatched) / total;
    const score = COVERAGE_WEIGHT * coverage + RANK_WEIGHT * s.rank;
    return { ...s, score };
  });

  scored.sort((a, b) => b.score - a.score || b.rank - a.rank || a.title.localeCompare(b.title));

  return scored.slice(0, RESULT_LIMIT).map((s) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    folderId: s.folderId,
    snippet: s.snippet,
  }));
}

async function runSearch(args: {
  noteFilter: Prisma.Sql;
  folderFilter: Prisma.Sql | null;
  query: string;
}): Promise<SearchHit[]> {
  const query = normalizeQuery(args.query);
  if (!query) return [];

  const lexemes = await getLexemes(query);
  if (lexemes.length === 0) return [];

  const tsquery = buildOrTsquery(query);

  const exactNotesRows = await exactNotes(args.noteFilter, tsquery, query);
  const exactFolderRows = args.folderFilter
    ? await exactFolders(args.folderFilter, tsquery, query)
    : [];

  const unmatched = await unmatchedTerms(args.noteFilter, args.folderFilter, query);

  const fuzzyNoteRows = await fuzzyNotes(args.noteFilter, unmatched);
  const fuzzyFolderRows = args.folderFilter
    ? await fuzzyFolders(args.folderFilter, unmatched)
    : [];

  return mergeAndRank(
    lexemes,
    [...exactNotesRows, ...exactFolderRows],
    [...fuzzyNoteRows, ...fuzzyFolderRows]
  );
}

export async function searchUserItems(
  userId: string,
  query: string
): Promise<SearchHit[]> {
  return runSearch({
    noteFilter: Prisma.sql`n."userId" = ${userId}`,
    folderFilter: Prisma.sql`"userId" = ${userId}`,
    query,
  });
}

export async function searchPublicNotes(query: string): Promise<PublicHit[]> {
  const hits = await runSearch({
    noteFilter: Prisma.sql`n."isPublic" = true`,
    folderFilter: null,
    query,
  });
  return hits.map((h) => ({ id: h.id, title: h.title, snippet: h.snippet }));
}
