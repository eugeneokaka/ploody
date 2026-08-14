import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("folders:[id]");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const { name } = await req.json();

    log.info("Renaming folder", { id, name });

    if (!name?.trim()) {
      log.warn("Empty folder name rejected");
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    await prisma.folder.update({
      where: { id, userId },
      data: { name: name.trim() },
    });

    log.info(`Folder renamed`, { id });
    return NextResponse.json({ success: true });
  } catch (e) {
    log.error("Failed to rename folder", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const withContents = req.nextUrl.searchParams.get("withContents") === "true";

    log.info("Deleting folder", { id, withContents });

    await prisma.$transaction(async (tx) => {
      if (withContents) {
        const folderIds: string[] = [];
        const queue = [id];
        while (queue.length) {
          const current = queue.shift()!;
          folderIds.push(current);
          const children = await tx.folder.findMany({
            where: { parentId: current, userId },
            select: { id: true },
          });
          for (const child of children) queue.push(child.id);
        }

        const notes = await tx.note.findMany({
          where: { folderId: { in: folderIds }, userId },
          select: { id: true },
        });
        const noteIds = notes.map((n) => n.id);

        if (noteIds.length > 0) {
          await tx.comment.deleteMany({ where: { noteId: { in: noteIds } } });
          await tx.noteVersion.deleteMany({ where: { noteId: { in: noteIds } } });
          await tx.note.deleteMany({ where: { id: { in: noteIds } } });
        }

        await tx.folder.deleteMany({ where: { id: { in: folderIds }, userId } });
      } else {
        await tx.folder.delete({ where: { id, userId } });
      }
    });

    log.info(`Folder deleted`, { id, withContents });
    return NextResponse.json({ success: true });
  } catch (e) {
    log.error("Failed to delete folder", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
