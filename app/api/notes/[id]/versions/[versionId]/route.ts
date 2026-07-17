import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("versions:[versionId]");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function GET(
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

    return NextResponse.json(version);
  } catch (e) {
    log.error("Failed to fetch version", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const userId = await getUserId();
    const { id, versionId } = await params;
    const { label } = await req.json();

    const note = await prisma.note.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const version = await prisma.noteVersion.update({
      where: { id: versionId, noteId: id },
      data: { label },
    });

    return NextResponse.json(version);
  } catch (e) {
    log.error("Failed to update version", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
