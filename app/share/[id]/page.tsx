"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { FileText, ExternalLink, BookmarkPlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { renderContent } from "@/lib/render-content";
import { CommentSection } from "@/components/comment-section";
import { useSession } from "@/lib/auth-client";

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { data: session } = useSession();
  const [note, setNote] = useState<{ title: string; content: string; userId: string; authorName?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copying, setCopying] = useState(false);

  async function handleCopy() {
    setCopying(true);
    try {
      const res = await fetch(`/api/notes/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: id }),
      });
      if (!res.ok) throw new Error("Failed to copy");
      const data = await res.json();
      router.push(`/notes/${data.id}`);
    } catch {
      setCopying(false);
    }
  }

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
          {note.authorName && (
            <span className="text-xs text-muted-foreground">
              by {note.authorName}
            </span>
          )}
          {session?.user && (
            <button
              onClick={handleCopy}
              disabled={copying}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
            >
              {copying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="h-3.5 w-3.5" />
              )}
              {copying ? "Copying..." : "Copy to my notes"}
            </button>
          )}
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
      <div className="border-t border-border">
        <CommentSection noteId={id} authorId={note.userId} />
      </div>
    </div>
  );
}
