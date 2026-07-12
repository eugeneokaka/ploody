"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { NoteEditor } from "@/components/note-editor";
import { Input } from "@/components/ui/input";

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/notes/${id}`)
      .then((r) => r.json())
      .then((note) => {
        setTitle(note.title);
        setContent(note.content);
        setFolderId(note.folderId);
        setLoading(false);
      });
  }, [id]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: title || "Untitled", content }),
    });
    setSaving(false);
  }, [id, title, content]);

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
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="border-0 bg-transparent text-lg font-semibold shadow-none focus-visible:ring-0"
        />
        <div className="flex-1" />
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

      <div className="flex-1">
        <NoteEditor key={id} content={content} onChange={setContent} />
      </div>
    </div>
  );
}
