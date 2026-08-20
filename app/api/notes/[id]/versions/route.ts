import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("versions");

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

    const note = await prisma.note.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const versions = await prisma.noteVersion.findMany({
      where: { noteId: id },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        label: true,
        title: true,
        createdAt: true,
      },
    });

    return NextResponse.json(versions);
  } catch (e) {
    log.error("Failed to fetch versions", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const body = await req.json();
    const { title, content, label, updateByLabel } = body;

    const note = await prisma.note.findUnique({
      where: { id, userId },
      select: { id: true, autosaveVersionId: true },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (updateByLabel && note.autosaveVersionId) {
      const existing = await prisma.noteVersion.findUnique({
        where: { id: note.autosaveVersionId },
      });
      if (existing) {
        const updated = await prisma.noteVersion.update({
          where: { id: existing.id },
          data: {
            title: title || "Untitled",
            content: content || "",
          },
        });
        log.info(`Autosave version updated in place`, { noteId: id, versionId: existing.id });
        return NextResponse.json(updated);
      }
    }

    const latest = await prisma.noteVersion.findFirst({
      where: { noteId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const version = await prisma.$transaction(async (tx) => {
      const v = await tx.noteVersion.create({
        data: {
          noteId: id,
          version: nextVersion,
          title: title || "Untitled",
          content: content || "",
          label: label || null,
        },
      });

      const noteUpdate: Record<string, string> = {};
      if (updateByLabel && label) {
        noteUpdate.autosaveVersionId = v.id;
      } else {
        noteUpdate.currentVersionId = v.id;
      }

      await tx.note.update({
        where: { id },
        data: noteUpdate,
      });

      return v;
    });

    log.info(`Version created`, { noteId: id, version: nextVersion });
    return NextResponse.json(version);
  } catch (e) {
    log.error("Failed to create version", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
