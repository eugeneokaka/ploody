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

    const note = await prisma.note.findUnique({
      where: { id, userId },
    });

    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (e) {
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
    const { title, content, folderId } = await req.json();

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (folderId !== undefined) data.folderId = folderId || null;

    const note = await prisma.note.update({
      where: { id, userId },
      data,
    });

    log.info(`Note updated`, { id });
    return NextResponse.json(note);
  } catch (e) {
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
