import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import type { Prisma, TodoPriority } from "@prisma/client";
import { isTodoColor, isTodoPriority } from "@/lib/todo-constants";

const log = createLogger("todos");

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
  const detail = e instanceof Error ? e.message : "Unknown error";
  const isAuth = detail === "Unauthorized";
  return NextResponse.json(
    { error: detail },
    { status: isAuth ? 401 : 500 }
  );
}

export async function GET() {
  try {
    const userId = await getUserId();
    const todos = await prisma.todo.findMany({
      where: { userId },
      orderBy: [
        { completed: "asc" },
        { dueDate: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      select: todoSelect,
    });

    return NextResponse.json(todos.map(serializeTodo));
  } catch (e) {
    return errorResponse(e, "Failed to fetch todos");
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const title =
      typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    const priority: TodoPriority = isTodoPriority(body.priority)
      ? body.priority
      : "MEDIUM";
    const color = isTodoColor(body.color) ? body.color : "yellow";

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

    const dueDate = normalizeDueDate(body.dueDate);
    if (!dueDate.ok) {
      return NextResponse.json(
        { error: "Invalid due date" },
        { status: 400 }
      );
    }

    const todo = await prisma.todo.create({
      data: {
        userId,
        title,
        priority,
        color,
        noteId,
        dueDate: dueDate.value,
      },
      select: todoSelect,
    });

    log.info("Todo created", { id: todo.id });
    return NextResponse.json(serializeTodo(todo), { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to create todo");
  }
}
