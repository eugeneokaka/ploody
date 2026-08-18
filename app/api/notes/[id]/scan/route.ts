import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { ingestNote, deleteChunks } from "@/lib/ai/ingest";

const log = createLogger("ai:scan");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;

    const note = await prisma.note.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const chunks = await ingestNote(id, userId);
    await prisma.note.update({ where: { id }, data: { aiEnabled: true } });

    log.info(`Note indexed`, { id, chunks });
    return NextResponse.json({ aiEnabled: true, chunks });
  } catch (e) {
    log.error("Failed to scan note", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const isAuth = message === "Unauthorized";
    return NextResponse.json({ error: message }, { status: isAuth ? 401 : 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;

    const note = await prisma.note.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteChunks(id);
    await prisma.note.update({ where: { id }, data: { aiEnabled: false } });

    log.info(`AI disabled for note`, { id });
    return NextResponse.json({ aiEnabled: false });
  } catch (e) {
    log.error("Failed to disable AI", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const isAuth = message === "Unauthorized";
    return NextResponse.json({ error: message }, { status: isAuth ? 401 : 500 });
  }
}
