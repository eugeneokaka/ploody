"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChannelProvider, useChannel } from "ably/react";
import { useSession } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

type Comment = {
  id: string;
  content: string;
  noteId: string;
  authorId: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
};

function CommentList({ noteId, authorId }: { noteId: string; authorId: string }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/public/notes/${noteId}/comments?limit=5`);
      const data = await res.json();
      if (Array.isArray(data.comments)) {
        setComments(data.comments);
        setHasMore(data.hasMore ?? false);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (loadingMore || comments.length === 0) return;
    setLoadingMore(true);
    try {
      const last = comments[comments.length - 1];
      const res = await fetch(
        `/api/public/notes/${noteId}/comments?limit=5&cursor=${encodeURIComponent(last.createdAt)}`
      );
      const data = await res.json();
      if (Array.isArray(data.comments)) {
        setComments((prev) => [...prev, ...data.comments]);
        setHasMore(data.hasMore ?? false);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [noteId, comments, loadingMore]);

  const { publish } = useChannel(`note:${noteId}:comments`, (message) => {
    if (message.name === "new") {
      const newComment = message.data as Comment;
      if (newComment.authorId === userId) return;
      setComments((prev) => {
        if (prev.some((c) => c.id === newComment.id)) return prev;
        return [...prev, newComment];
      });
    } else if (message.name === "deleted") {
      const { id } = message.data as { id: string };
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  });

  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      content: input.trim(),
      noteId,
      authorId: userId ?? "unknown",
      createdAt: new Date().toISOString(),
      author: {
        id: userId ?? "unknown",
        name: session?.user?.name ?? "You",
        image: session?.user?.image ?? null,
      },
    };

    setComments((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await fetch(`/api/public/notes/${noteId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });

      if (res.ok) {
        const saved = await res.json();
        setComments((prev) => prev.map((c) => (c.id === tempId ? saved : c)));
      } else {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
      }
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
    } finally {
      setSending(false);
    }
  }, [input, sending, noteId, userId, session?.user?.name, session?.user?.image]);

  const handleDelete = useCallback(
    async (commentId: string) => {
      const prevComments = commentsRef.current;
      setComments((prev) => prev.filter((c) => c.id !== commentId));

      try {
        const res = await fetch(
          `/api/public/notes/${noteId}/comments/${commentId}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          setComments(prevComments);
        }
      } catch {
        setComments(prevComments);
      }
    },
    [noteId]
  );

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-4">
      <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h2>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={comment.author.image ?? undefined} />
                <AvatarFallback className="text-xs">
                  {comment.author.name?.charAt(0).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.author.name}
                  </span>
                  {comment.authorId === authorId && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">
                      Author
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm mt-0.5">{comment.content}</p>
              </div>
              {userId === comment.authorId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="self-start p-1 text-muted-foreground/40 hover:text-destructive transition-colors"
                  title="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more comments"}
          </button>
        </div>
      )}

      {userId ? (
        <div className="mt-6 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a comment..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Sign in to leave a comment.
        </p>
      )}
    </div>
  );
}

export function CommentSection({ noteId, authorId }: { noteId: string; authorId: string }) {
  return (
    <ChannelProvider channelName={`note:${noteId}:comments`}>
      <CommentList noteId={noteId} authorId={authorId} />
    </ChannelProvider>
  );
}
