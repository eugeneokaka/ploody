import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { searchPublicNotes } from "@/lib/search/search";

const log = createLogger("public:search");

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!q) return NextResponse.json([]);

    const results = await searchPublicNotes(q);
    return NextResponse.json(results);
  } catch (e) {
    log.error("Public search failed", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
