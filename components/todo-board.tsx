"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  CircleCheckBig,
  Flag,
  Link2,
  PartyPopper,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TODO_COLORS,
  TODO_COLOR_LABELS,
  isTodoColor,
  isTodoPriority,
  type TodoColor,
  type TodoPriorityValue,
} from "@/lib/todo-constants";

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  priority: TodoPriorityValue;
  dueDate: string | null;
  color: TodoColor;
  noteId: string | null;
  createdAt: string;
  updatedAt: string;
  note: { id: string; title: string } | null;
}

interface TodoApiItem extends Omit<TodoItem, "priority" | "color"> {
  priority: string;
  color: string;
}

interface NoteOption {
  id: string;
  title: string;
}

type Filter = "all" | "active" | "done";

const STICKY_STYLES: Record<
  TodoColor,
  { card: string; swatch: string }
> = {
  yellow: {
    card: "border-[#eeda6f] bg-[#fff3a3]",
    swatch: "bg-[#fff3a3]",
  },
  pink: {
    card: "border-[#f3b3c8] bg-[#ffc9da]",
    swatch: "bg-[#ffc9da]",
  },
  blue: {
    card: "border-[#9ed0ef] bg-[#bfe6ff]",
    swatch: "bg-[#bfe6ff]",
  },
  green: {
    card: "border-[#a9dca7] bg-[#c9f2c7]",
    swatch: "bg-[#c9f2c7]",
  },
  purple: {
    card: "border-[#c9a8eb] bg-[#e2c9ff]",
    swatch: "bg-[#e2c9ff]",
  },
  orange: {
    card: "border-[#f0b77c] bg-[#ffd4a8]",
    swatch: "bg-[#ffd4a8]",
  },
};

const PRIORITY_LABELS: Record<TodoPriorityValue, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const PRIORITY_ITEMS = [
  { value: "LOW", label: PRIORITY_LABELS.LOW },
  { value: "MEDIUM", label: PRIORITY_LABELS.MEDIUM },
  { value: "HIGH", label: PRIORITY_LABELS.HIGH },
] as const;

const PRIORITY_STYLES: Record<TodoPriorityValue, string> = {
  LOW: "bg-sky-500/15 text-sky-800",
  MEDIUM: "bg-amber-500/20 text-amber-800",
  HIGH: "bg-rose-500/20 text-rose-800",
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "To do" },
  { id: "done", label: "Done!" },
];

const TILTS = [
  "-rotate-2",
  "rotate-1",
  "rotate-2",
  "-rotate-[1.5deg]",
  "rotate-[1.5deg]",
  "-rotate-1",
];

function toTodo(todo: TodoApiItem): TodoItem {
  return {
    ...todo,
    color: isTodoColor(todo.color) ? todo.color : "yellow",
    priority: isTodoPriority(todo.priority) ? todo.priority : "MEDIUM",
  };
}

function sortTodos(items: TodoItem[]) {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    const aDue = a.dueDate
      ? new Date(a.dueDate).getTime()
      : Number.POSITIVE_INFINITY;
    const bDue = b.dueDate
      ? new Date(b.dueDate).getTime()
      : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function dueDateKey(iso: string) {
  return iso.slice(0, 10);
}

function formatDueDate(iso: string) {
  const [year, month, day] = dueDateKey(iso).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", timeZone: "UTC" }
  );
}

function isOverdue(todo: TodoItem) {
  if (!todo.dueDate || todo.completed) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
  return dueDateKey(todo.dueDate) < today;
}

function formatDateForInput(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function TodoBoard() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [notes, setNotes] = useState<NoteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<TodoColor>("yellow");
  const [priority, setPriority] = useState<TodoPriorityValue>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [noteId, setNoteId] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const initialized = useRef(false);

  const noteItems = useMemo(
    () => [
      { value: "none", label: "No note attached" },
      ...notes.map((note) => ({ value: note.id, label: note.title })),
    ],
    [notes]
  );

  const loadBoard = useCallback(async () => {
    try {
      const [todosRes, notesRes] = await Promise.all([
        fetch("/api/todos"),
        fetch("/api/notes"),
      ]);
      if (!todosRes.ok || !notesRes.ok) throw new Error("Failed to load");

      const [todoData, noteData] = await Promise.all([
        todosRes.json() as Promise<TodoApiItem[]>,
        notesRes.json() as Promise<NoteOption[]>,
      ]);

      setTodos(sortTodos(todoData.map(toTodo)));
      setNotes(noteData);
    } catch {
      toast.error("Couldn't load your sticky notes. Try refreshing?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadBoard();
  }, [loadBoard]);

  const counts = useMemo(
    () => ({
      all: todos.length,
      active: todos.filter((todo) => !todo.completed).length,
      done: todos.filter((todo) => todo.completed).length,
    }),
    [todos]
  );

  const progress =
    counts.all === 0 ? 0 : Math.round((counts.done / counts.all) * 100);

  const visibleTodos = useMemo(
    () =>
      todos.filter((todo) => {
        if (filter === "active") return !todo.completed;
        if (filter === "done") return todo.completed;
        return true;
      }),
    [filter, todos]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          color,
          priority,
          dueDate: dueDate || null,
          noteId: noteId || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create todo");

      const created = toTodo((await res.json()) as TodoApiItem);
      setTodos((prev) => sortTodos([created, ...prev]));

      setTitle("");
      setDueDate("");
      setNoteId("");
      setColor("yellow");
      setPriority("MEDIUM");
      toast.success("Pinned to the board!");
    } catch {
      toast.error("That sticky note didn't stick. Try again?");
    } finally {
      setCreating(false);
    }
  }

  async function toggleTodo(todo: TodoItem) {
    const nextCompleted = !todo.completed;
    setTodos((prev) =>
      sortTodos(
        prev.map((item) =>
          item.id === todo.id ? { ...item, completed: nextCompleted } : item
        )
      )
    );

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      if (!res.ok) throw new Error("Failed to update todo");

      const updated = toTodo((await res.json()) as TodoApiItem);
      setTodos((prev) =>
        sortTodos(prev.map((item) => (item.id === todo.id ? updated : item)))
      );
    } catch {
      setTodos((prev) =>
        sortTodos(
          prev.map((item) =>
            item.id === todo.id
              ? { ...item, completed: todo.completed }
              : item
          )
        )
      );
      toast.error("Couldn't tick that one. Try again?");
    }
  }

  async function updateTodo(
    todo: TodoItem,
    changes: Partial<
      Pick<TodoItem, "title" | "color" | "priority" | "dueDate" | "noteId">
    >
  ) {
    const previous: Partial<TodoItem> = {};
    if ("title" in changes) previous.title = todo.title;
    if ("color" in changes) previous.color = todo.color;
    if ("priority" in changes) previous.priority = todo.priority;
    if ("dueDate" in changes) previous.dueDate = todo.dueDate;
    if ("noteId" in changes) previous.noteId = todo.noteId;

    setTodos((prev) =>
      sortTodos(
        prev.map((item) =>
          item.id === todo.id ? { ...item, ...changes } : item
        )
      )
    );

    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error("Failed to update todo");

      const updated = toTodo((await res.json()) as TodoApiItem);
      setTodos((prev) =>
        sortTodos(prev.map((item) => (item.id === todo.id ? updated : item)))
      );
    } catch {
      setTodos((prev) =>
        sortTodos(
          prev.map((item) =>
            item.id === todo.id ? { ...item, ...previous } : item
          )
        )
      );
      toast.error("Couldn't save that change. Try again?");
    }
  }

  async function removeTodo(todo: TodoItem) {
    setTodos((prev) => prev.filter((item) => item.id !== todo.id));

    try {
      const res = await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete todo");
      toast.success("Sticky note tossed.");
    } catch {
      setTodos((prev) => sortTodos([...prev, todo]));
      toast.error("Couldn't toss that note. Try again?");
    }
  }

  function requestDelete(todo: TodoItem) {
    toast("Toss this sticky note?", {
      description: `"${todo.title}" will be gone for good.`,
      action: {
        label: "Toss it",
        onClick: () => {
          void removeTodo(todo);
        },
      },
      cancel: { label: "Keep it", onClick: () => {} },
    });
  }

  function clearCompleted() {
    const done = todos.filter((todo) => todo.completed);
    if (done.length === 0) return;

    toast(
      `Clear ${done.length} finished ${done.length === 1 ? "task" : "tasks"}?`,
      {
        description: "They'll float off your board.",
        action: {
          label: "Clear",
          onClick: () => {
            void (async () => {
              setTodos((prev) => prev.filter((todo) => !todo.completed));
              const results = await Promise.all(
                done.map((todo) =>
                  fetch(`/api/todos/${todo.id}`, { method: "DELETE" })
                )
              );
              if (results.some((res) => !res.ok)) {
                toast.error("Some notes didn't want to leave.");
                void loadBoard();
              } else {
                toast.success("Board tidied up!");
              }
            })();
          },
        },
        cancel: { label: "Keep them", onClick: () => {} },
      }
    );
  }

  if (loading) {
    return (
      <div className="todos-bg flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 h-24 animate-pulse rounded-2xl bg-muted/70" />
          <div className="mb-8 h-36 animate-pulse rounded-[6px] bg-muted/60" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-[5px] bg-muted/60"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="todos-bg flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-5xl font-bold leading-none text-stone-900 dark:text-stone-50 sm:text-6xl">
                Sticky Todos
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Little notes, big wins. Pin a task, tick it off, and keep the
                good vibes going.
              </p>
            </div>

            <div className="w-full max-w-xs rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Your progress
                  </p>
                  <p className="text-3xl font-bold leading-none text-foreground">
                    {counts.done}
                    <span className="text-lg text-muted-foreground">
                      {" "}
                      / {counts.all}
                    </span>
                  </p>
                </div>
                <PartyPopper
                  className={cn(
                    "h-8 w-8",
                    counts.all > 0 && counts.done === counts.all
                      ? "text-primary"
                      : "text-muted-foreground/40"
                  )}
                />
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-pink-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {counts.all === 0
                  ? "Your board is a blank canvas."
                  : counts.done === counts.all
                    ? "All clear. You're amazing!"
                    : `${counts.active} little win${
                        counts.active === 1 ? "" : "s"
                      } to go.`}
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleCreate}
          className={cn(
            "relative mb-8 rounded-[6px] border p-4 pt-7 shadow-[0_14px_28px_-18px_rgba(41,37,36,0.55)] transition-colors sm:p-5 sm:pt-8",
            STICKY_STYLES[color].card
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 rounded-sm bg-white/50 shadow-sm ring-1 ring-white/40"
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0 text-stone-500" />
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What's one happy thing to get done?"
                maxLength={200}
                aria-label="New task title"
                className="w-full min-w-0 bg-transparent text-2xl text-stone-900 outline-none placeholder:text-stone-500/70"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-stone-800 disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              {creating ? "Pinning..." : "Pin it"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full bg-white/40 px-2 py-1"
              aria-label="Sticky note color"
            >
              {TODO_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  title={TODO_COLOR_LABELS[option]}
                  aria-label={`Use ${TODO_COLOR_LABELS[option]}`}
                  aria-pressed={color === option}
                  className={cn(
                    "h-5 w-5 rounded-full border border-stone-900/15 transition-transform hover:scale-110",
                    STICKY_STYLES[option].swatch,
                    color === option &&
                      "ring-2 ring-stone-900 ring-offset-1 ring-offset-transparent"
                  )}
                />
              ))}
            </div>

            <Select
              items={PRIORITY_ITEMS}
              value={priority}
              onValueChange={(value) =>
                setPriority((value ?? "MEDIUM") as TodoPriorityValue)
              }
            >
              <SelectTrigger
                type="button"
                size="sm"
                aria-label="Priority"
                className="h-7 w-auto gap-1.5 rounded-full border-0 bg-white/40 px-2.5 text-xs font-semibold text-stone-700 shadow-none focus-visible:ring-2 focus-visible:ring-stone-900/20 dark:bg-white/40 dark:hover:bg-white/50"
              >
                <Flag className="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-32">
                {PRIORITY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger
                type="button"
                aria-label="Due date"
                className="flex h-7 items-center gap-1.5 rounded-full bg-white/40 px-2.5 text-xs font-semibold text-stone-700 outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-stone-900/20"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {dueDate
                  ? formatDueDate(`${dueDate}T12:00:00.000Z`)
                  : "Due date"}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2">
                <Calendar
                  mode="single"
                  selected={
                    dueDate ? new Date(`${dueDate}T12:00:00`) : undefined
                  }
                  onSelect={(date) => {
                    setDueDate(date ? formatDateForInput(date) : "");
                    setDateOpen(false);
                  }}
                />
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setDueDate("");
                      setDateOpen(false);
                    }}
                    className="mt-1 w-full rounded-md px-2 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-900/5 hover:text-stone-900"
                  >
                    Clear date
                  </button>
                )}
              </PopoverContent>
            </Popover>

            <Select
              items={noteItems}
              value={noteId || "none"}
              onValueChange={(value) =>
                setNoteId(!value || value === "none" ? "" : value)
              }
            >
              <SelectTrigger
                type="button"
                size="sm"
                aria-label="Attach a note"
                className="h-7 max-w-48 gap-1.5 rounded-full border-0 bg-white/40 px-2.5 text-xs font-semibold text-stone-700 shadow-none focus-visible:ring-2 focus-visible:ring-stone-900/20 dark:bg-white/40 dark:hover:bg-white/50"
              >
                <StickyNote className="h-3.5 w-3.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-56">
                {noteItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </form>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1 shadow-sm backdrop-blur">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === option.id
                    ? "bg-stone-900 text-white shadow-sm dark:bg-stone-50 dark:text-stone-900"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {option.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    filter === option.id
                      ? "bg-white/20 dark:bg-stone-900/10"
                      : "bg-muted-foreground/10"
                  )}
                >
                  {counts[option.id]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {counts.done > 0 && (
            <button
              type="button"
              onClick={clearCompleted}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-emerald-400/60 hover:text-emerald-600"
            >
              <CircleCheckBig className="h-3.5 w-3.5" />
              Clear done
            </button>
          )}
        </div>

        {visibleTodos.length === 0 ? (
          <div className="relative mx-auto mt-4 max-w-xl rounded-[6px] border border-dashed border-amber-300 bg-[#fff8d6] px-6 py-12 text-center shadow-sm">
            <PartyPopper className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="mt-3 text-3xl font-bold text-stone-900">
              {counts.all === 0
                ? "A fresh sticky note is waiting"
                : filter === "done"
                  ? "Nothing ticked off yet"
                  : "All clear. Go do a little dance"}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              {counts.all === 0
                ? "Write down one tiny task above and make today a little happier."
                : filter === "done"
                  ? "Finish a task and it will land here."
                  : "Your board is looking wonderfully empty."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTodos.map((todo, index) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                index={index}
                onToggle={toggleTodo}
                onUpdate={updateTodo}
                onDelete={requestDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TodoCardProps {
  todo: TodoItem;
  index: number;
  onToggle: (todo: TodoItem) => void;
  onUpdate: (
    todo: TodoItem,
    changes: Partial<
      Pick<TodoItem, "title" | "color" | "priority" | "dueDate" | "noteId">
    >
  ) => void;
  onDelete: (todo: TodoItem) => void;
}

function TodoCard({
  todo,
  index,
  onToggle,
  onUpdate,
  onDelete,
}: TodoCardProps) {
  function commitTitle(event: FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const next = input.value.trim();
    if (!next) {
      input.value = todo.title;
      return;
    }
    if (next !== todo.title) {
      onUpdate(todo, { title: next });
    }
  }

  const style = STICKY_STYLES[todo.color];
  const overdue = isOverdue(todo);

  return (
    <article
      className={cn(
        "group relative flex min-h-[210px] flex-col rounded-[5px] border p-4 pt-7 shadow-[0_14px_26px_-16px_rgba(41,37,36,0.6)] transition-all duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_20px_32px_-18px_rgba(41,37,36,0.65)]",
        style.card,
        TILTS[index % TILTS.length],
        todo.completed && "opacity-80 saturate-[0.82]"
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 -rotate-2 rounded-sm bg-white/50 shadow-sm ring-1 ring-white/40"
      />

      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={todo.completed}
          aria-label={`Mark "${todo.title}" ${
            todo.completed ? "as active" : "as done"
          }`}
          onClick={() => onToggle(todo)}
          className={cn(
            "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            todo.completed
              ? "border-emerald-600 bg-emerald-500 text-white shadow-inner"
              : "border-stone-400/70 hover:border-stone-600 hover:bg-white/40"
          )}
        >
          {todo.completed && (
            <Check className="todo-check-pop h-3.5 w-3.5" strokeWidth={3} />
          )}
        </button>

        <input
          key={todo.title}
          defaultValue={todo.title}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          maxLength={200}
          aria-label="Task title"
          className={cn(
            "min-w-0 flex-1 bg-transparent text-xl leading-tight text-stone-900 outline-none",
            todo.completed &&
              "text-stone-700/80 line-through decoration-2 decoration-stone-600/70"
          )}
        />

        <button
          type="button"
          onClick={() => onDelete(todo)}
          aria-label={`Delete "${todo.title}"`}
          className="mt-0.5 shrink-0 rounded-full p-1.5 text-stone-500/80 transition-colors hover:bg-rose-500/15 hover:text-rose-700"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {todo.note && (
        <Link
          href={`/notes/${todo.note.id}`}
          className="ml-8 mt-2 inline-flex max-w-[calc(100%-2rem)] items-center gap-1 truncate text-xs font-semibold text-stone-700 underline decoration-stone-400/60 decoration-dotted underline-offset-2 transition-colors hover:text-stone-950"
        >
          <Link2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{todo.note.title}</span>
        </Link>
      )}

      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              PRIORITY_STYLES[todo.priority]
            )}
          >
            <Flag className="h-2.5 w-2.5" strokeWidth={3} />
            {PRIORITY_LABELS[todo.priority]}
          </span>

          {todo.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                overdue
                  ? "bg-rose-500/20 text-rose-800"
                  : "bg-stone-900/5 text-stone-600"
              )}
            >
              <CalendarDays className="h-2.5 w-2.5" strokeWidth={3} />
              {overdue ? "Overdue · " : ""}
              {formatDueDate(todo.dueDate)}
            </span>
          )}

          {todo.completed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
              Done
            </span>
          )}
        </div>

        <div
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full bg-white/35 px-1.5 py-1 transition-opacity",
            todo.completed
              ? "opacity-100"
              : "opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
          )}
          aria-label="Change sticky note color"
        >
          {TODO_COLORS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onUpdate(todo, { color: option })}
              title={TODO_COLOR_LABELS[option]}
              aria-label={`Make this note ${TODO_COLOR_LABELS[option]}`}
              aria-pressed={todo.color === option}
              className={cn(
                "h-4 w-4 rounded-full border border-stone-900/15 transition-transform hover:scale-125",
                STICKY_STYLES[option].swatch,
                todo.color === option &&
                  "ring-2 ring-stone-900/70 ring-offset-1 ring-offset-transparent"
              )}
            />
          ))}
        </div>
      </div>
    </article>
  );
}
