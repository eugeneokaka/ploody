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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="sticky-note-soft tape-accent flex w-full max-w-sm flex-col items-center gap-3 rounded-[6px] px-6 py-10 text-center">
          <FileText className="h-12 w-12 text-amber-500/60" />
          <h1 className="text-xl font-bold text-stone-900">Note not found</h1>
          <p className="text-sm text-stone-600">
            This note is private or doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Go to Ploody
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-amber-200/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-3xl px-3 py-2.5 sm:px-6 sm:py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700/70">
            Shared note
          </p>
          <h1 className="text-base font-bold text-stone-900 dark:text-stone-50 sm:text-lg">
            {note.title || "Untitled"}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 sm:mt-2 sm:gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-amber-800">
              <FileText className="h-4 w-4" />
            </span>
            {note.authorName && (
              <span className="text-xs text-stone-500 dark:text-stone-400">
                by {note.authorName}
              </span>
            )}
            {session?.user && (
              <button
                onClick={handleCopy}
                disabled={copying}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/85 disabled:opacity-50 sm:gap-1.5 sm:px-3"
              >
                {copying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {copying ? "Copying..." : "Copy to my notes"}
                </span>
              </button>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-stone-500 hover:bg-amber-200/40 hover:text-stone-900"
            >
              <ExternalLink className="h-4 w-4" />
              Ploody
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
        <div className="note-paper tape-accent rounded-[8px] px-5 py-7 shadow-[0_18px_36px_-22px_rgba(41,37,36,0.55)] sm:px-8 sm:py-9">
          <div
            className="tiptap focus:outline-none"
            dangerouslySetInnerHTML={{ __html: renderContent(note.content) }}
          />
        </div>
      </div>
      <div className="border-t border-amber-200/70">
        <CommentSection noteId={id} authorId={note.userId} />
      </div>
    </div>
  );
}
