"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  _count: { notes: number; children: number };
}

interface FolderPickerProps {
  noteId: string;
  currentFolderId: string | null;
  currentFolderName?: string;
  onMoved?: (folderId: string | null, folderName?: string) => void;
}

async function api(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export function FolderPicker({
  noteId,
  currentFolderId,
  currentFolderName,
  onMoved,
}: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [rootFolders, setRootFolders] = useState<FolderItem[]>([]);
  const [subFolders, setSubFolders] = useState<Record<string, FolderItem[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadFolders = useCallback(async (parentId?: string) => {
    try {
      const params = parentId ? `?parentId=${parentId}` : "";
      const data = await api(`/api/folders${params}`);
      if (parentId) {
        setSubFolders((prev) => ({ ...prev, [parentId]: data }));
      } else {
        setRootFolders(data);
      }
    } catch {
      // silent
    }
  }, []);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev && !loaded) {
        loadFolders();
        setLoaded(true);
      }
      return !prev;
    });
  }, [loaded, loadFolders]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setExpanded(new Set());
      }
    }
    if (open) document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  const handleSelect = useCallback(
    async (id: string | null, name?: string) => {
      try {
        await api(`/api/notes/${noteId}`, {
          method: "PATCH",
          body: JSON.stringify({ folderId: id || null }),
        });
        onMoved?.(id || null, name);
      } catch {
        // silent
      }
      setOpen(false);
      setExpanded(new Set());
    },
    [noteId, onMoved],
  );

  const toggleExpand = useCallback(
    async (folderId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(folderId)) {
          next.delete(folderId);
        } else {
          next.add(folderId);
        }
        return next;
      });
      if (!subFolders[folderId]) {
        await loadFolders(folderId);
      }
    },
    [subFolders, loadFolders],
  );

  function renderFolder(folder: FolderItem, depth: number = 0) {
    const isExpanded = expanded.has(folder.id);
    const children = subFolders[folder.id] ?? [];
    const hasChildren = folder._count.children > 0;

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
            currentFolderId === folder.id &&
              "bg-muted font-medium text-foreground",
          )}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(folder.id, e)}
              className="shrink-0 p-0"
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  isExpanded && "rotate-90",
                )}
              />
            </button>
          ) : (
            <span className="block w-3.5 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => handleSelect(folder.id, folder.name)}
            className="flex flex-1 items-center gap-2 min-w-0 text-left"
          >
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <FolderIcon
                className={cn(
                  "h-4 w-4 shrink-0",
                  currentFolderId === folder.id
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
            )}
            <span className="truncate">{folder.name}</span>
          </button>
        </div>
        {isExpanded &&
          children.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <FolderIcon className="h-4 w-4 shrink-0" />
        <span className="max-w-[160px] truncate">
          {currentFolderName || "No folder"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-popover shadow-lg">
          <div className="max-h-72 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                !currentFolderId &&
                  "bg-muted font-medium text-foreground",
              )}
            >
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <span>No folder</span>
            </button>
            {rootFolders.map((f) => renderFolder(f))}
            {loaded && rootFolders.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                No folders yet
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
