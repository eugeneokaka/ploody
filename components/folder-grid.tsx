"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Folder as FolderIcon, Plus, FileText, FolderPlus, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
  _count: { notes: number; children: number };
}

const PAGE_SIZE = 6;

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

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Folders
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href="/notes/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <Plus className="h-3.5 w-3.5" />
            New Note
          </Link>
          <button
            onClick={() => {
              setShowInput(true);
              setName("");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Folder
          </button>
        </div>
      </div>

      {folders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
          <FolderIcon className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            No folders yet
          </p>
          <p className="text-xs text-muted-foreground">
            Create a folder to start organizing your notes
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {folders.map((folder) => {
              const itemCount = folder._count.notes + folder._count.children;
              return (
                <button
                  key={folder.id}
                  onClick={() => router.push(`/folders/${folder.id}`)}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <FolderIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate">
                      {folder.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {itemCount === 0
                        ? "Empty"
                        : `${itemCount} item${itemCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </button>
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
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowInput(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
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
              className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary w-full"
            >
              <Plus className="h-4 w-4" />
              Create new folder
            </button>
          )}
        </div>
      )}

      <div className="mt-10 flex flex-col items-center gap-3 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">
          Need a quick note? <Link href="/notes/new" className="font-medium text-primary hover:underline">Create one here</Link>
        </p>
      </div>
    </div>
  );
}
