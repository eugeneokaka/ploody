import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { queryNote, type QueryHistory } from "@/lib/ai/query";

const log = createLogger("ai:ask");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;

    const body = await req.json();
    const question = (body.question as string | undefined)?.trim();
    const history = (body.history as QueryHistory[] | undefined) ?? [];

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    const result = await queryNote(id, userId, question, history);
    return NextResponse.json(result);
  } catch (e) {
    log.error("Failed to answer question", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const isAuth = message === "Unauthorized";
    return NextResponse.json({ error: message }, { status: isAuth ? 401 : 500 });
  }
}
