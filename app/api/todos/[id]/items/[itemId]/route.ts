import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

const log = createLogger("todos:[id]:items:[itemId]");

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

async function syncTodoCompleted(todoId: string) {
  const items = await prisma.todoItem.findMany({
    where: { todoId },
    select: { completed: true },
  });

  if (items.length === 0) return undefined;

  const allDone = items.every((item) => item.completed);
  await prisma.todo.update({
    where: { id: todoId },
    data: { completed: allDone },
  });
  return allDone;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const userId = await getUserId();
    const { id, itemId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const todo = await prisma.todo.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!todo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: { title?: string; completed?: boolean } = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return NextResponse.json(
          { error: "Item title is required" },
          { status: 400 }
        );
      }
      data.title = title;
    }

    if (body.completed !== undefined) {
      if (typeof body.completed !== "boolean") {
        return NextResponse.json(
          { error: "Invalid completed value" },
          { status: 400 }
        );
      }
      data.completed = body.completed;
    }

    const item = await prisma.todoItem.update({
      where: { id: itemId, todoId: id },
      data,
      select: { id: true, title: true, completed: true },
    });

    const todoCompleted = await syncTodoCompleted(id);

    log.info("Todo item updated", { id, itemId });
    return NextResponse.json({ item, todoCompleted });
  } catch (e) {
    return errorResponse(e, "Failed to update todo item");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const userId = await getUserId();
    const { id, itemId } = await params;

    const todo = await prisma.todo.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!todo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.todoItem.delete({
      where: { id: itemId, todoId: id },
    });

    const todoCompleted = await syncTodoCompleted(id);

    log.info("Todo item deleted", { id, itemId });
    return NextResponse.json({ success: true, todoCompleted });
  } catch (e) {
    return errorResponse(e, "Failed to delete todo item");
  }
}
