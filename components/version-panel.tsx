"use client";

import { useState, useEffect, useCallback } from "react";
import { X, History, Clock, Pencil, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Version {
  id: string;
  version: number;
  label: string | null;
  title: string;
  createdAt: string;
}

interface FullVersion extends Version {
  content: string;
}

interface VersionPanelProps {
  noteId: string;
  currentTitle: string;
  currentContent: string;
  currentVersionId: string | null;
  onSelect: (title: string, content: string) => void;
  onVersionChanged: () => void;
  onClose: () => void;
}

export function VersionPanel({
  noteId,
  currentTitle,
  currentContent,
  currentVersionId,
  onSelect,
  onVersionChanged,
  onClose,
}: VersionPanelProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState("");

  const loadVersions = useCallback(() => {
    fetch(`/api/notes/${noteId}/versions`)
      .then((r) => r.json())
      .then((data) => {
        setVersions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [noteId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const selectVersion = useCallback(
    async (versionId: string) => {
      const res = await fetch(`/api/notes/${noteId}/versions/${versionId}`);
      const data: FullVersion = await res.json();
      setSelectedId(versionId);
      onSelect(data.title, data.content);
    },
    [noteId, onSelect]
  );

  const createVersion = useCallback(async () => {
    setCreating(true);
    const res = await fetch(`/api/notes/${noteId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: currentTitle, content: currentContent }),
    });
    const data = await res.json();
    setVersions((prev) => [{ ...data, label: null }, ...prev]);
    setSelectedId(null);
    setCreating(false);
    toast.success("Version saved");
    onVersionChanged();
  }, [noteId, currentTitle, currentContent, onVersionChanged]);

  const restoreVersion = useCallback(
    async (versionId: string) => {
      setRestoring(versionId);
      await fetch(`/api/notes/${noteId}/restore/${versionId}`, { method: "POST" });
      await loadVersions();
      setRestoring(null);
      toast.success("Version restored");
      onVersionChanged();
    },
    [noteId, loadVersions, onVersionChanged]
  );

  const startEditLabel = useCallback((v: Version) => {
    setEditingLabel(v.id);
    setLabelValue(v.label || "");
  }, []);

  const saveLabel = useCallback(
    async (versionId: string) => {
      await fetch(`/api/notes/${noteId}/versions/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelValue || null }),
      });
      setEditingLabel(null);
      setVersions((prev) =>
        prev.map((v) => (v.id === versionId ? { ...v, label: labelValue || null } : v))
      );
    },
    [noteId, labelValue]
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isCurrentVersion = (versionId: string) => {
    return currentVersionId === versionId;
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-border bg-background shadow-lg">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold">Versions</span>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-border px-4 py-2">
        <button
          onClick={createVersion}
          disabled={creating}
          className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          {creating ? "Saving..." : "Save as Version"}
        </button>
      </div>

      <div className="border-b border-border bg-primary/5 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Working Copy</span>
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            Current
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {currentTitle || "Untitled"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Clock className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No versions yet</p>
            <p className="text-[10px] text-muted-foreground/60">
              Click "Save as Version" to snapshot your work
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {versions.map((v) => (
              <div key={v.id}>
                <div
                  onClick={() => {
                    if (selectedId === v.id) {
                      setSelectedId(null);
                    } else {
                      selectVersion(v.id);
                    }
                  }}
                  className={`flex w-full cursor-pointer items-center gap-2 border-b border-border px-4 py-2.5 text-left transition-colors hover:bg-muted ${
                    selectedId === v.id ? "bg-muted ring-1 ring-inset ring-primary/20" : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectedId === v.id ? setSelectedId(null) : selectVersion(v.id);
                    }
                  }}
                >
                  <span className="shrink-0 rounded bg-muted-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    v{v.version}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {editingLabel === v.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            value={labelValue}
                            onChange={(e) => setLabelValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveLabel(v.id);
                              if (e.key === "Escape") setEditingLabel(null);
                            }}
                            placeholder="Add label..."
                            className="h-5 w-full rounded border border-border bg-background px-1 text-[11px] outline-none focus:border-primary"
                            autoFocus
                          />
                          <button
                            onClick={() => saveLabel(v.id)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate text-xs font-medium">
                            {v.label || `Version ${v.version}`}
                          </span>
                          {isCurrentVersion(v.id) && (
                            <span className="shrink-0 rounded bg-emerald-500/10 px-1 py-px text-[9px] font-medium text-emerald-500">
                              Current
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditLabel(v);
                            }}
                            className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {formatDate(v.createdAt)}
                      </span>
                      {!isCurrentVersion(v.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreVersion(v.id);
                          }}
                          disabled={restoring === v.id}
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground disabled:opacity-50"
                        >
                          {restoring === v.id ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                          ) : (
                            "Restore"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
