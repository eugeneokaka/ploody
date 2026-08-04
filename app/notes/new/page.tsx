"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { NoteEditor } from "@/components/note-editor";
import { Input } from "@/components/ui/input";

function NewNoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const folderId = searchParams.get("folderId");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        title: title || "Untitled",
        content,
        folderId,
      }),
    });
    const note = await res.json();
    setSaving(false);

    if (folderId) {
      router.push(`/folders/${folderId}`);
    } else {
      router.push(`/notes/${note.id}`);
    }
  }, [title, content, folderId, router]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-3 sm:px-6 py-2.5 sm:py-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="min-w-0 border-0 bg-transparent px-0 text-base sm:text-lg font-semibold shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-1.5 sm:gap-3 mt-1.5 sm:mt-2">
        <Link
          href={folderId ? `/folders/${folderId}` : "/"}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1 sm:gap-2 rounded-lg bg-primary px-2.5 sm:px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
        </button>
        </div>
      </div>

      <div className="flex-1">
        <NoteEditor content={content} onChange={setContent} />
      </div>
    </div>
  );
}

export default function NewNotePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <NewNoteForm />
    </Suspense>
  );
}
