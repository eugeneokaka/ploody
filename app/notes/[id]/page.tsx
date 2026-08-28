"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2, Globe, Lock, Copy, Check, History, Loader2, BookmarkPlus, Sparkles, WifiOff, Timer, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { NoteEditor } from "@/components/note-editor";
import { Input } from "@/components/ui/input";
import { FolderPicker } from "@/components/folder-picker";
import { VersionPanel } from "@/components/version-panel";
import { CommentSection } from "@/components/comment-section";

const AUTOSAVE_IDLE_MS = 10000;
const AUTOSAVE_THROTTLE_MS = 30000;

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | undefined>();
  const [isPublic, setIsPublic] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [editVersionId, setEditVersionId] = useState<string | null>(null);
  const [noteUserId, setNoteUserId] = useState<string | null>(null);
  const [copiedFromAuthor, setCopiedFromAuthor] = useState<string | null>(null);
  const [copiedFromTitle, setCopiedFromTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editingVersion, setEditingVersion] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const prevVersionIdRef = useRef<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--note-header-height",
        `${el.offsetHeight}px`
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    const onScroll = () => {
      const isScrolled = window.scrollY > 0;
      setScrolled(isScrolled);
      if (!isScrolled) setControlsOpen(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [isOnline, setIsOnline] = useState(true);
  const offlineKey = `offline-note:${id}`;

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const flushOffline = useCallback(async () => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(offlineKey);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          isPublic: data.isPublic,
        }),
      });
      if (res.ok) {
        localStorage.removeItem(offlineKey);
        toast.success("Offline changes synced to cloud");
      }
    } catch {
      // still offline or corrupt data — keep the local copy
    }
  }, [offlineKey, id]);

  const prevOnlineRef = useRef(true);
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      flushOffline();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, flushOffline]);

  const mountedRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (navigator.onLine) flushOffline();
  }, [loading, flushOffline]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutosavedRef = useRef<string>("");
  const lastAutosaveTimeRef = useRef(0);

  const doAutosave = useCallback(() => {
    const snapshot = JSON.stringify({ title: title || "Untitled", content });
    if (snapshot === lastAutosavedRef.current) return;

    const now = Date.now();
    const elapsed = now - lastAutosaveTimeRef.current;
    if (elapsed < AUTOSAVE_THROTTLE_MS) {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(doAutosave, AUTOSAVE_THROTTLE_MS - elapsed);
      return;
    }

    lastAutosaveTimeRef.current = now;
    fetch(`/api/notes/${id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || "Untitled", content, label: "Autosave", updateByLabel: true }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then(() => {
        lastAutosavedRef.current = snapshot;
      })
      .catch(() => {
        lastAutosaveTimeRef.current = 0;
      });
  }, [id, title, content]);

  useEffect(() => {
    if (!autosaveEnabled || !isOnline || loading) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(doAutosave, AUTOSAVE_IDLE_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [title, content, autosaveEnabled, isOnline, loading, doAutosave]);

  const loadNote = useCallback(({ showLoader = false } = {}) => {
    if (showLoader) setReloading(true);
    fetch(`/api/notes/${id}`)
      .then((r) => r.json())
      .then((note) => {
        const newVersionId = note.currentVersionId ?? null;
        const versionChanged = newVersionId !== prevVersionIdRef.current;
        if (versionChanged && prevVersionIdRef.current !== null) {
          setEditingVersion(true);
        }
        prevVersionIdRef.current = newVersionId;

        setCurrentVersionId(newVersionId);
        setEditVersionId(note.autosaveVersionId ?? null);
        setNoteUserId(note.userId);
        setCopiedFromAuthor(note.copiedFrom?.user?.name ?? null);
        setCopiedFromTitle(note.copiedFrom?.currentVersion?.title ?? null);
        setFolderId(note.folderId);
        setFolderName(note.folder?.name);
        setIsPublic(note.isPublic);
        setAiEnabled(note.aiEnabled ?? false);
        setAutosaveEnabled(note.autosaveEnabled ?? false);

        const autosaveVersion = note.autosaveVersion;
        const displayTitle =
          autosaveVersion?.title ?? note.currentVersion?.title ?? "Untitled";
        const displayContent =
          autosaveVersion?.content ?? note.currentVersion?.content ?? "";
        setTitle(displayTitle);
        setContent(displayContent);
        lastAutosavedRef.current = JSON.stringify({
          title: displayTitle,
          content: displayContent,
        });

        setEditorKey((k) => k + 1);
        setLoading(false);
        setReloading(false);
      })
      .catch(() => setReloading(false));
  }, [id]);

  useEffect(() => {
    loadNote();
  }, [loadNote]);

  const handleSave = useCallback(async () => {
    if (!navigator.onLine) {
      try {
        localStorage.setItem(
          offlineKey,
          JSON.stringify({
            title: title || "Untitled",
            content,
            isPublic,
            savedAt: Date.now(),
          })
        );
      } catch {
        // storage unavailable
      }
      toast.info("You're offline — saved on this device");
      return;
    }

    setSaving(true);
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: title || "Untitled", content, isPublic }),
    });
    setSaving(false);
    toast.success("Note saved");

    if (aiEnabled) {
      fetch(`/api/notes/${id}/scan`, { method: "POST" })
        .then((r) => r.json())
        .then((d) => toast.success(`Re-indexed (${d.chunks ?? 0} chunks)`))
        .catch(() => {});
    }
  }, [id, title, content, isPublic, aiEnabled, offlineKey]);

  const togglePublic = useCallback(() => {
    const next = !isPublic;
    setIsPublic(next);
    fetch(`/api/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isPublic: next }),
    });
  }, [id, isPublic]);

  const toggleAutosave = useCallback(() => {
    const next = !autosaveEnabled;
    setAutosaveEnabled(next);
    fetch(`/api/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ autosaveEnabled: next }),
    });
    if (next) {
      lastAutosavedRef.current = JSON.stringify({ title: title || "Untitled", content });
    }
  }, [id, autosaveEnabled, title, content]);

  const copyShareLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [id]);

  const handleSelectVersion = useCallback((versionTitle: string, versionContent: string) => {
    setTitle(versionTitle);
    setContent(versionContent);
    setEditingVersion(true);
    setEditorKey((k) => k + 1);
    toast.info("Version loaded into editor");
  }, []);

  useEffect(() => {
    if (editingVersion) {
      const timer = setTimeout(() => setEditingVersion(false), 300);
      return () => clearTimeout(timer);
    }
  }, [editingVersion, editorKey]);

  const handleDelete = useCallback(() => {
    toast("Delete this note?", {
      description: "This cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          await fetch(`/api/notes/${id}`, { method: "DELETE" });
          if (folderId) {
            router.push(`/folders/${folderId}`);
          } else {
            router.push("/");
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  }, [id, folderId, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div
        ref={headerRef}
        className="sticky top-14 z-50 border-b border-border bg-background px-3 sm:px-6 py-1.5 sm:py-2"
      >
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title..."
            className="min-w-0 flex-1 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          />
          {scrolled && (
            <button
              type="button"
              onClick={() => setControlsOpen((v) => !v)}
              title={controlsOpen ? "Hide controls" : "Show controls"}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {controlsOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
        {(!scrolled || controlsOpen) && (
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1 sm:mt-1.5">
          <Link
            href={folderId ? `/folders/${folderId}` : "/"}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-6 w-px bg-border" />
          <FolderPicker
            noteId={id}
            currentFolderId={folderId}
            currentFolderName={folderName}
            onMoved={(newFolderId, newFolderName) => {
              setFolderId(newFolderId);
              setFolderName(newFolderName);
            }}
          />
          {copiedFromAuthor && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2.5 py-1 text-xs">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/20">
                <BookmarkPlus className="h-2.5 w-2.5 text-blue-500" />
              </div>
              <span className="hidden sm:inline text-muted-foreground">Copied from</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">{copiedFromAuthor}</span>
              {copiedFromTitle && (
                <>
                  <span className="text-muted-foreground/60">|</span>
                  <span className="truncate max-w-36 text-muted-foreground">{copiedFromTitle}</span>
                </>
              )}
            </div>
          )}
          <div className="h-6 w-px bg-border" />
          {aiEnabled && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
              <Sparkles className="h-3 w-3" />
              AI enabled
            </span>
          )}
          {!isOnline && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-600 dark:text-red-400">
              <WifiOff className="h-3 w-3" />
              Offline
            </span>
          )}
          <div className="hidden sm:block sm:flex-1" />
          <button
            onClick={toggleAutosave}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              autosaveEnabled
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <Timer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Autosave</span>
          </button>
          <button
            onClick={togglePublic}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              isPublic
                ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {isPublic ? (
              <Globe className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{isPublic ? "Public" : "Private"}</span>
          </button>
          {isPublic && (
            <button
              onClick={copyShareLink}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
            </button>
          )}
          <button
            onClick={() => setShowVersions(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <History className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Versions</span>
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-primary px-2.5 sm:px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
          </button>
        </div>
        )}
      </div>

      <div className={`flex-1 relative min-h-[60vh] ${editingVersion ? "animate-editor-switch" : ""}`}>
        {reloading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity">
            <div className="flex items-center gap-2 rounded-lg bg-popover px-4 py-2 shadow-lg border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading version...</span>
            </div>
          </div>
        )}
        <NoteEditor
          key={`${id}-v${editorKey}`}
          content={content}
          onChange={setContent}
          noteId={id}
          aiEnabled={aiEnabled}
          onAiEnabledChange={setAiEnabled}
        />
      </div>

      {isPublic && noteUserId && (
        <div className="border-t border-border">
          <CommentSection noteId={id} authorId={noteUserId} />
        </div>
      )}

      {showVersions && (
        <VersionPanel
          noteId={id}
          currentTitle={title}
          currentContent={content}
          currentVersionId={currentVersionId}
          editVersionId={editVersionId}
          onSelect={handleSelectVersion}
          onVersionChanged={() => loadNote({ showLoader: true })}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}
