"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Folder as FolderIcon, Plus, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string;
  name: string;
  _count: { notes: number; children: number };
}

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export function FolderBar() {
  const router = useRouter();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");
  const initialized = useRef(false);

  const loadFolders = useCallback(async () => {
    const data = await api("/api/folders");
    setFolders(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadFolders();
    }
  }, [loadFolders]);

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
    await loadFolders();
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
      {loading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <>
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => router.push(`/folders/${folder.id}`)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="max-w-[120px] truncate">{folder.name}</span>
              {folder._count.notes + folder._count.children > 0 && (
                <span className="text-xs text-muted-foreground">
                  {folder._count.notes + folder._count.children}
                </span>
              )}
            </button>
          ))}

          {showInput ? (
            <form
              onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
              className="flex shrink-0 items-center gap-1.5"
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Folder name..."
                autoFocus
                className="h-8 w-36 text-sm"
                onBlur={() => { if (!name) setShowInput(false); }}
              />
              <button
                type="submit"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              New Folder
            </button>
          )}
        </>
      )}
    </div>
  );
}
