import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { searchUserItems } from "@/lib/search/search";

const log = createLogger("search");

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!q) return NextResponse.json([]);

    log.info(`Searching`, { query: q, userId: session.user.id });
    const results = await searchUserItems(session.user.id, q);
    return NextResponse.json(results);
  } catch (e) {
    log.error("Search failed", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
