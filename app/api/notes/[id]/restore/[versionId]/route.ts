import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
      select: { id: true },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const version = await prisma.noteVersion.findUnique({
      where: { id: versionId, noteId: id },
    });
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const latest = await tx.noteVersion.findFirst({
        where: { noteId: id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      const newVersion = await tx.noteVersion.create({
        data: {
          noteId: id,
          version: nextVersion,
          title: version.title,
          content: version.content,
        },
      });

      return tx.note.update({
        where: { id },
        data: {
          currentVersionId: newVersion.id,
        },
        include: { currentVersion: true },
      });
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
