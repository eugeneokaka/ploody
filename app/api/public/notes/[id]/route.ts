import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("public:notes:[id]");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const note = await prisma.note.findUnique({
      where: { id, isPublic: true },
      select: {
        id: true,
        userId: true,
        updatedAt: true,
        currentVersion: { select: { title: true, content: true } },
      },
    });

    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: note.id,
      userId: note.userId,
      title: note.currentVersion?.title ?? "Untitled",
      content: note.currentVersion?.content ?? "",
      updatedAt: note.updatedAt,
    });
  } catch (e) {
    log.error("Failed to fetch public note", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
