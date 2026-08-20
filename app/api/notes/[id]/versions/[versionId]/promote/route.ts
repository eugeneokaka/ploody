import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("versions:promote");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const userId = await getUserId();
    const { id, versionId } = await params;

    const note = await prisma.note.findUnique({
      where: { id, userId },
      select: { id: true, autosaveVersionId: true },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (note.autosaveVersionId !== versionId) {
      return NextResponse.json(
        { error: "Version is not the autosave version" },
        { status: 400 }
      );
    }

    const version = await prisma.noteVersion.findUnique({
      where: { id: versionId, noteId: id },
    });
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const updated = await prisma.note.update({
      where: { id },
      data: {
        currentVersionId: versionId,
        autosaveVersionId: null,
      },
      include: { currentVersion: true },
    });

    log.info(`Autosave version promoted to current`, { noteId: id, versionId });
    return NextResponse.json(updated);
  } catch (e) {
    log.error("Failed to promote version", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const isAuth = message === "Unauthorized";
    return NextResponse.json({ error: message }, { status: isAuth ? 401 : 500 });
  }
}
