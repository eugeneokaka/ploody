import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("public:search");

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 1) {
      return NextResponse.json([]);
    }

    const query = q.replace(/[^\w\s]/g, "").trim();
    if (!query) return NextResponse.json([]);

    const results = await prisma.$queryRaw<SearchResult[]>`
      SELECT n.id, nv.title, 'note'::text AS type, n."folderId",
             ts_rank(n."searchVector", plainto_tsquery('english', ${query})) AS rank,
             ts_headline('english', nv.content, plainto_tsquery('english', ${query}), 'MaxWords=20, MinWords=8') AS snippet
      FROM note n
      JOIN note_version nv ON n."currentVersionId" = nv.id
      WHERE n."isPublic" = true
        AND n."searchVector" @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT 10
    `;

    const mapped = results.map((r) => ({
      id: r.id,
      title: r.title,
      snippet: r.snippet,
    }));

    return NextResponse.json(mapped);
  } catch (e) {
    log.error("Public search failed", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

interface SearchResult {
  id: string;
  title: string;
  snippet: string | null;
  rank: number;
}
