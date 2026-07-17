"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { renderContent } from "@/lib/render-content";

export default function SharePage() {
  const params = useParams();
  const id = params.id as string;
  const [note, setNote] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/public/notes/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setNote(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <FileText className="h-12 w-12 text-muted-foreground/30" />
        <h1 className="text-xl font-semibold">Note not found</h1>
        <p className="text-sm text-muted-foreground">
          This note is private or doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-primary hover:underline"
        >
          Go to Ploody
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="flex-1 text-lg font-semibold">{note.title || "Untitled"}</h1>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Ploody
          </Link>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-8 py-6">
        <div
          className="tiptap focus:outline-none"
          dangerouslySetInnerHTML={{ __html: renderContent(note.content) }}
        />
      </div>
    </div>
  );
}
