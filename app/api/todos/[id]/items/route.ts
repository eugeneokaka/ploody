import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

const log = createLogger("todos:[id]:items");

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

function errorResponse(e: unknown, message: string) {
  log.error(message, e);
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2025"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const detail = e instanceof Error ? e.message : "Unknown error";
  const isAuth = detail === "Unauthorized";
  return NextResponse.json(
    { error: detail },
    { status: isAuth ? 401 : 500 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "Item title is required" },
        { status: 400 }
      );
    }

    const todo = await prisma.todo.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!todo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const last = await prisma.todoItem.findFirst({
      where: { todoId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const [item] = await prisma.$transaction([
      prisma.todoItem.create({
        data: {
          todoId: id,
          title,
          position: (last?.position ?? -1) + 1,
        },
        select: { id: true, title: true, completed: true },
      }),
      prisma.todo.update({
        where: { id },
        data: { completed: false },
      }),
    ]);

    log.info("Todo item created", { id, itemId: item.id });
    return NextResponse.json({ item, todoCompleted: false }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to create todo item");
  }
}
