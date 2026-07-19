import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getAblyRest } from "@/lib/ably-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "5"), 20);

    const note = await prisma.note.findUnique({
      where: { id, isPublic: true },
      select: { id: true },
    });

    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const where: Record<string, unknown> = { noteId: id };
    if (cursor) {
      where.createdAt = { gt: new Date(cursor) };
    }

    const comments = await prisma.comment.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
      take: limit + 1,
    });

    const hasMore = comments.length > limit;
    if (hasMore) comments.pop();

    return NextResponse.json({ comments, hasMore });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const note = await prisma.note.findUnique({
      where: { id, isPublic: true },
      select: { id: true },
    });

    if (!note) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        noteId: id,
        authorId: session.user.id,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    const ably = getAblyRest();
    ably.channels.get(`note:${id}:comments`).publish("new", comment);

    return NextResponse.json(comment);
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
