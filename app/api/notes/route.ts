import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("notes");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId();
    const folderId = req.nextUrl.searchParams.get("folderId") || null;

    const where: Record<string, unknown> = { userId };
    if (folderId) where.folderId = folderId;

    const notes = await prisma.note.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        folderId: true,
        updatedAt: true,
        createdAt: true,
        currentVersion: {
          select: { title: true },
        },
      },
    });

    const mapped = notes.map((n) => ({
      id: n.id,
      title: n.currentVersion?.title ?? "Untitled",
      folderId: n.folderId,
      updatedAt: n.updatedAt,
      createdAt: n.createdAt,
    }));

    log.info(`Returned ${mapped.length} notes`, { folderId });
    return NextResponse.json(mapped);
  } catch (e) {
    log.error("Failed to fetch notes", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json();
    const { title, content, folderId, isPublic } = body;

    console.log("[POST /api/notes] body:", JSON.stringify(body, null, 2));
    log.info("Creating note", { title, folderId, isPublic });

    const note = await prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          folderId: folderId || null,
          isPublic: isPublic ?? false,
          userId,
        },
      });

      const version = await tx.noteVersion.create({
        data: {
          noteId: created.id,
          version: 1,
          title: title?.trim() || "Untitled",
          content: content || "",
        },
      });

      return tx.note.update({
        where: { id: created.id },
        data: { currentVersionId: version.id },
        include: { currentVersion: true },
      });
    });

    console.log("[POST /api/notes] created:", JSON.stringify(note, null, 2));
    log.info(`Note created`, { id: note.id });
    return NextResponse.json(note);
  } catch (e) {
    console.error("[POST /api/notes] error:", e);
    log.error("Failed to create note", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
