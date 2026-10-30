"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Folder as FolderIcon, Plus, FileText, FolderPlus, ChevronDown, MoreVertical, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
  _count: { notes: number; children: number };
}

const PAGE_SIZE = 6;

const TILTS = [
  "-rotate-2",
  "rotate-1",
  "rotate-2",
  "-rotate-[1.5deg]",
  "rotate-[1.5deg]",
  "-rotate-1",
];

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export function FolderGrid() {
  const router = useRouter();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const initialized = useRef(false);

  const loadInitial = useCallback(async () => {
    const { folders: data, hasMore: more } = await api(
      `/api/folders?limit=${PAGE_SIZE}`
    );
    setFolders(data);
    setHasMore(more);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadInitial();
    }
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !folders.length) return;
    setLoadingMore(true);
    const last = folders[folders.length - 1];
    const { folders: data, hasMore: more } = await api(
      `/api/folders?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(last.createdAt)}`
    );
    setFolders((prev) => [...prev, ...data]);
    setHasMore(more);
    setLoadingMore(false);
  }, [folders, loadingMore]);

  async function handleCreate() {
    if (!name.trim()) {
      setShowInput(false);
      return;
    }
    await api("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: name.trim() }),
    });
    setName("");
    setShowInput(false);
    await loadInitial();
  }

  async function handleDelete(id: string) {
    await api(`/api/folders/${id}`, { method: "DELETE" });
    await loadInitial();
  }

  function handleDeleteWithContents(id: string) {
    toast("Delete folder and contents?", {
      description:
        "This will delete all notes and subfolders inside it. This cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          await api(`/api/folders/${id}?withContents=true`, { method: "DELETE" });
          await loadInitial();
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[6px] border border-amber-200/60 bg-amber-100/40"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="rounded-full bg-primary/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-amber-900 dark:bg-primary/10 dark:text-amber-200">
          Folders
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href="/notes/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/85"
          >
            <Plus className="h-3.5 w-3.5" />
            New Note
          </Link>
          <button
            onClick={() => {
              setShowInput(true);
              setName("");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-background/60 px-3.5 py-1.5 text-xs font-semibold text-stone-600 backdrop-blur transition-colors hover:bg-amber-100/60 hover:text-stone-900 dark:hover:bg-amber-300/10"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </button>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-[#fff9d9]/70 py-12 text-center">
          <FolderIcon className="h-10 w-10 text-amber-500/40" />
          <p className="text-sm font-medium text-stone-700">
            No folders yet
          </p>
          <p className="text-xs text-stone-500">
            Create a folder to start organizing your notes
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 pt-3 sm:grid-cols-3">
            {folders.map((folder, index) => {
              const itemCount = folder._count.notes + folder._count.children;
              return (
                <div
                  key={folder.id}
                  className={cn(
                    "group relative sticky-note tape-accent rounded-[6px] transition-all duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_20px_32px_-18px_rgba(41,37,36,0.65)]",
                    TILTS[index % TILTS.length]
                  )}
                >
                  <button
                    onClick={() => router.push(`/folders/${folder.id}`)}
                    className="flex w-full flex-col gap-2 p-4 pt-6 text-left"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-900/10">
                      <FolderIcon className="h-5 w-5 text-stone-800" />
                    </div>
                    <div>
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {folder.name}
                      </p>
                      <p className="text-xs text-stone-600">
                        {itemCount === 0
                          ? "Empty"
                          : `${itemCount} item${itemCount !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="absolute right-1.5 top-1.5 rounded-full p-1 text-stone-500 transition-colors hover:bg-stone-900/10 hover:text-stone-900">
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handleDelete(folder.id)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => handleDeleteWithContents(folder.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete with contents
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {loadingMore ? (
                  "Loading..."
                ) : (
                  <>
                    Show more
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {folders.length > 0 && (
        <div className="mt-6">
          {showInput ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Folder name..."
                autoFocus
                className="h-9 text-sm max-w-[200px]"
                onBlur={() => {
                  if (!name) setShowInput(false);
                }}
              />
              <button
                type="submit"
                className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/85"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowInput(false)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setShowInput(true);
                setName("");
              }}
              className="flex w-full items-center gap-2 rounded-[6px] border border-dashed border-amber-300 bg-[#fff9d9]/60 p-4 text-sm font-medium text-stone-600 transition-colors hover:border-amber-500 hover:bg-[#fff3a3]/70 hover:text-stone-900"
            >
              <Plus className="h-4 w-4" />
              Create new folder
            </button>
          )}
        </div>
      )}

      <div className="sticky-note-soft tape-accent mt-10 flex flex-col items-center gap-3 rounded-[6px] px-6 py-8 text-center">
        <FileText className="h-8 w-8 text-amber-500/70" />
        <p className="text-sm text-stone-600">
          Need a quick note?{" "}
          <Link
            href="/notes/new"
            className="font-semibold text-stone-900 underline decoration-amber-500/60 underline-offset-4 hover:decoration-amber-600"
          >
            Create one here
          </Link>
        </p>
      </div>
    </div>
  );
}
