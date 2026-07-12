"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Folder as FolderIcon,
  FolderOpen,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
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

export function FolderSidebar() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [subFolders, setSubFolders] = useState<Record<string, FolderItem[]>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const initialized = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  const loadFolders = useCallback(async (parentId?: string) => {
    const params = parentId ? `?parentId=${parentId}` : "";
    const data = await api(`/api/folders${params}`);
    if (parentId) {
      setSubFolders((prev) => ({ ...prev, [parentId]: data }));
    } else {
      setFolders(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadFolders();
    }
  }, [loadFolders]);

  async function handleExpand(folderId: string) {
    const newExpanded = new Set(expanded);
    if (expanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
      if (!subFolders[folderId]) await loadFolders(folderId);
    }
    setExpanded(newExpanded);
  }

  async function handleCreate(parentId?: string) {
    if (!newName.trim()) return;
    await api("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: newName.trim(), parentId: parentId ?? null }),
    });
    setNewName("");
    setAddingTo(null);
    if (parentId) {
      await loadFolders(parentId);
    } else {
      await loadFolders();
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    await api(`/api/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditing(null);
    await loadFolders();
  }

  async function handleDelete(id: string) {
    await api(`/api/folders/${id}`, { method: "DELETE" });
    await loadFolders();
  }

  function renderFolder(folder: FolderItem, depth: number = 0) {
    const isExpanded = expanded.has(folder.id);
    const children = subFolders[folder.id] ?? [];

    const isActive = pathname === `/folders/${folder.id}`;

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted",
            isActive && "bg-muted",
            depth > 0 && "ml-4"
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleExpand(folder.id);
            }}
            className="shrink-0 p-0"
          >
            {folder._count.children > 0 ? (
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            ) : (
              <span className="block w-3.5" />
            )}
          </button>

          <button
            onClick={() => router.push(`/folders/${folder.id}`)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <FolderIcon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
            )}
            {editing === folder.id ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleRename(folder.id); }}
                className="flex-1 min-w-0"
              >
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleRename(folder.id)}
                  autoFocus
                  className="h-6 text-xs"
                />
              </form>
            ) : (
              <span className="truncate">{folder.name}</span>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-accent">
              <MoreVertical className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36">
              <DropdownMenuItem
                onClick={() => {
                  setAddingTo(folder.id);
                  setNewName("");
                }}
              >
                <Plus className="h-4 w-4" />
                New Subfolder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditing(folder.id);
                  setEditName(folder.name);
                }}
              >
                <Pencil className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => handleDelete(folder.id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isExpanded && children.map((child) => renderFolder(child, depth + 1))}

        {isExpanded && addingTo === folder.id && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleCreate(folder.id); }}
            className="ml-8 mr-2 mt-1"
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Folder name..."
              autoFocus
              className="h-7 text-xs"
              onBlur={() => setAddingTo(null)}
            />
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Folders</h2>
        <button
          onClick={() => {
            setAddingTo("root");
            setNewName("");
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {addingTo === "root" && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
          className="mx-4 mb-2"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name..."
            autoFocus
            className="h-7 text-xs"
            onBlur={() => { if (!newName) setAddingTo(null); }}
          />
        </form>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {loading ? (
          <div className="flex flex-col gap-2 px-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : folders.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No folders yet. Create one to get started.
          </p>
        ) : (
          folders.map((f) => renderFolder(f))
        )}
      </div>
    </div>
  );
}
