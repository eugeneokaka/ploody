import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("search");

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 1) {
      return NextResponse.json([]);
    }

    const query = q.replace(/[^\w\s]/g, "").trim();
    if (!query) return NextResponse.json([]);

    log.info(`Searching`, { query, userId: session.user.id });

    const results = await prisma.$queryRaw<SearchResult[]>`
      SELECT n.id, nv.title, 'note'::text AS type, n."folderId",
             ts_rank(n."searchVector", plainto_tsquery('english', ${query})) AS rank,
             ts_headline('english', nv.content, plainto_tsquery('english', ${query}), 'MaxWords=12, MinWords=6') AS snippet
      FROM note n
      JOIN note_version nv ON n."currentVersionId" = nv.id
      WHERE n."userId" = ${session.user.id}
        AND n."searchVector" @@ plainto_tsquery('english', ${query})
      UNION ALL
      SELECT id, name AS title, 'folder'::text AS type, NULL::text AS "folderId",
             ts_rank("searchVector", plainto_tsquery('english', ${query})) AS rank,
             NULL::text AS snippet
      FROM folder
      WHERE "userId" = ${session.user.id}
        AND "searchVector" @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT 10
    `;

    const mapped = results.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      folderId: r.folderId,
      snippet: r.snippet,
    }));

    return NextResponse.json(mapped);
  } catch (e) {
    log.error("Search failed", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

interface SearchResult {
  id: string;
  title: string;
  type: "note" | "folder";
  folderId: string | null;
  rank: number;
  snippet: string | null;
}
