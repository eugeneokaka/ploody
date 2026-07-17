import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("notes:[id]");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    console.log("[GET /api/notes/:id] userId:", userId, "noteId:", id);

    const note = await prisma.note.findUnique({
      where: { id, userId },
      include: {
        folder: { select: { id: true, name: true } },
        currentVersion: true,
      },
    });
    console.log("[GET /api/notes/:id] result:", note ? `found note "${note.currentVersion?.title}"` : "NOT FOUND");

    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (e) {
    console.error("[GET /api/notes/:id] error:", e);
    log.error("Failed to fetch note", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const body = await req.json();
    const { title, content, folderId, isPublic } = body;

    console.log("[PATCH /api/notes/:id] noteId:", id, "body:", JSON.stringify(body, null, 2));

    const data: Record<string, unknown> = {};
    if (folderId !== undefined) data.folderId = folderId || null;
    if (isPublic !== undefined) data.isPublic = isPublic;

    if (Object.keys(data).length > 0) {
      await prisma.note.update({ where: { id, userId }, data });
    }

    if (title !== undefined || content !== undefined) {
      const note = await prisma.note.findUnique({
        where: { id, userId },
        select: { id: true, currentVersionId: true },
      });

      if (note?.currentVersionId) {
        const versionUpdate: Record<string, string> = {};
        if (title !== undefined) versionUpdate.title = title;
        if (content !== undefined) versionUpdate.content = content;
        await prisma.noteVersion.update({
          where: { id: note.currentVersionId },
          data: versionUpdate,
        });
      }
    }

    const note = await prisma.note.findUnique({
      where: { id },
      include: { folder: { select: { id: true, name: true } }, currentVersion: true },
    });

    console.log("[PATCH /api/notes/:id] updated:", JSON.stringify({ id: note?.id, isPublic: note?.isPublic }));
    log.info(`Note updated`, { id });
    return NextResponse.json(note);
  } catch (e) {
    console.error("[PATCH /api/notes/:id] error:", e);
    log.error("Failed to update note", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;

    await prisma.note.delete({ where: { id, userId } });

    log.info(`Note deleted`, { id });
    return NextResponse.json({ success: true });
  } catch (e) {
    log.error("Failed to delete note", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
