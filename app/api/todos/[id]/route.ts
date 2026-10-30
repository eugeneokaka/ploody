import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import type { TodoPriority } from "@prisma/client";
import { isTodoColor, isTodoPriority } from "@/lib/todo-constants";

const log = createLogger("todos:[id]");

const todoSelect = {
  id: true,
  title: true,
  completed: true,
  priority: true,
  dueDate: true,
  color: true,
  noteId: true,
  createdAt: true,
  updatedAt: true,
  note: {
    select: {
      id: true,
      currentVersion: { select: { title: true } },
    },
  },
  items: {
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      completed: true,
    },
  },
} satisfies Prisma.TodoSelect;

type TodoWithNote = Prisma.TodoGetPayload<{ select: typeof todoSelect }>;

function serializeTodo(todo: TodoWithNote) {
  return {
    ...todo,
    dueDate: todo.dueDate ? todo.dueDate.toISOString() : null,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
    note: todo.note
      ? {
          id: todo.note.id,
          title: todo.note.currentVersion?.title ?? "Untitled",
        }
      : null,
  };
}

function normalizeDueDate(
  value: unknown
): { ok: true; value: Date | null } | { ok: false } {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false };
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return { ok: false };
  return { ok: true, value: date };
}

async function getUserId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

async function noteBelongsToUser(noteId: string, userId: string) {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true },
  });
  return Boolean(note);
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

export async function PATCH(
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

    const data: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return NextResponse.json(
          { error: "Task title is required" },
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

    if (body.priority !== undefined) {
      if (!isTodoPriority(body.priority)) {
        return NextResponse.json(
          { error: "Invalid priority" },
          { status: 400 }
        );
      }
      data.priority = body.priority as TodoPriority;
    }

    if (body.color !== undefined) {
      if (!isTodoColor(body.color)) {
        return NextResponse.json(
          { error: "Invalid color" },
          { status: 400 }
        );
      }
      data.color = body.color;
    }

    if (body.dueDate !== undefined) {
      const dueDate = normalizeDueDate(body.dueDate);
      if (!dueDate.ok) {
        return NextResponse.json(
          { error: "Invalid due date" },
          { status: 400 }
        );
      }
      data.dueDate = dueDate.value;
    }

    if (body.noteId !== undefined) {
      const noteId =
        typeof body.noteId === "string" && body.noteId.trim()
          ? body.noteId
          : null;
      if (noteId && !(await noteBelongsToUser(noteId, userId))) {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 400 }
        );
      }
      data.noteId = noteId;
    }

    const todo = await prisma.todo.update({
      where: { id, userId },
      data,
      select: todoSelect,
    });

    log.info("Todo updated", { id });
    return NextResponse.json(serializeTodo(todo));
  } catch (e) {
    return errorResponse(e, "Failed to update todo");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();
    const { id } = await params;

    await prisma.todo.delete({ where: { id, userId } });

    log.info("Todo deleted", { id });
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "Failed to delete todo");
  }
}
