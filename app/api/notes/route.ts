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
        title: true,
        folderId: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    log.info(`Returned ${notes.length} notes`, { folderId });
    return NextResponse.json(notes);
  } catch (e) {
    log.error("Failed to fetch notes", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const { title, content, folderId } = await req.json();

    log.info("Creating note", { title, folderId });

    const note = await prisma.note.create({
      data: {
        title: title?.trim() || "Untitled",
        content: content || "",
        folderId: folderId || null,
        userId,
      },
    });

    log.info(`Note created`, { id: note.id });
    return NextResponse.json(note);
  } catch (e) {
    log.error("Failed to create note", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
