import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("notes:copy");

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { noteId } = await req.json();

    if (!noteId || typeof noteId !== "string") {
      return NextResponse.json({ error: "noteId is required" }, { status: 400 });
    }

    const source = await prisma.note.findUnique({
      where: { id: noteId, isPublic: true },
      include: { currentVersion: true },
    });

    if (!source || !source.currentVersion) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const copied = await prisma.$transaction(async (tx) => {
      const note = await tx.note.create({
        data: {
          userId: session.user.id,
          isPublic: false,
          copiedFromId: noteId,
        },
      });

      const version = await tx.noteVersion.create({
        data: {
          noteId: note.id,
          version: 1,
          title: source.currentVersion!.title,
          content: source.currentVersion!.content,
        },
      });

      return tx.note.update({
        where: { id: note.id },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      });
    });

    log.info("Note copied", {
      sourceId: noteId,
      newId: copied.id,
      userId: session.user.id,
    });

    return NextResponse.json(
      { id: copied.id, title: copied.currentVersion?.title },
      { status: 201 }
    );
  } catch (e) {
    log.error("Failed to copy note", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
