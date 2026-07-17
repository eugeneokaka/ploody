"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2, Globe, Lock, Copy, Check, History, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { NoteEditor } from "@/components/note-editor";
import { Input } from "@/components/ui/input";
import { FolderPicker } from "@/components/folder-picker";
import { VersionPanel } from "@/components/version-panel";

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | undefined>();
  const [isPublic, setIsPublic] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editingVersion, setEditingVersion] = useState(false);
  const [reloading, setReloading] = useState(false);
  const prevVersionIdRef = useRef<string | null>(null);

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

        setTitle(note.currentVersion?.title ?? "Untitled");
        setContent(note.currentVersion?.content ?? "");
        setFolderId(note.folderId);
        setFolderName(note.folder?.name);
        setIsPublic(note.isPublic);
        setCurrentVersionId(newVersionId);
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
    setSaving(true);
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: title || "Untitled", content, isPublic }),
    });
    setSaving(false);
    toast.success("Note saved");
  }, [id, title, content, isPublic]);

  const togglePublic = useCallback(() => {
    const next = !isPublic;
    setIsPublic(next);
    fetch(`/api/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isPublic: next }),
    });
  }, [id, isPublic]);

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

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (folderId) {
      router.push(`/folders/${folderId}`);
    } else {
      router.push("/");
    }
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
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
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
        <div className="h-6 w-px bg-border" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="border-0 bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
        />
        <div className="flex-1" />
        <button
          onClick={togglePublic}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
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
          {isPublic ? "Public" : "Private"}
        </button>
        {isPublic && (
          <button
            onClick={copyShareLink}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy link"}
          </button>
        )}
        <button
          onClick={() => setShowVersions(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <History className="h-3.5 w-3.5" />
          Versions
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
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className={`flex-1 relative ${editingVersion ? "animate-editor-switch" : ""}`}>
        {reloading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm transition-opacity">
            <div className="flex items-center gap-2 rounded-lg bg-popover px-4 py-2 shadow-lg border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading version...</span>
            </div>
          </div>
        )}
        <NoteEditor key={`${id}-v${editorKey}`} content={content} onChange={setContent} />
      </div>

      {showVersions && (
        <VersionPanel
          noteId={id}
          currentTitle={title}
          currentContent={content}
          currentVersionId={currentVersionId}
          onSelect={handleSelectVersion}
          onVersionChanged={() => loadNote({ showLoader: true })}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}
