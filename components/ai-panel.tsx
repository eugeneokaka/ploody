"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Trash2, ChevronLeft, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

type Message = { role: "user" | "assistant"; content: string };
type Source = {
  id: string;
  content: string;
  chunkIndex: number;
  similarity: number;
};

export function AiPanel({
  noteId,
  aiEnabled,
  onStateChange,
  onSourceClick,
  onClose,
}: {
  noteId: string;
  aiEnabled: boolean;
  onStateChange: (enabled: boolean) => void;
  onSourceClick?: (content: string) => void;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const historyRef = useRef<Message[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 80;
    stickToBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sources, loading]);

  const enable = useCallback(async () => {
    setIndexing(true);
    try {
      const res = await fetch(`/api/notes/${noteId}/scan`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to scan");
      }
      const data = await res.json();
      onStateChange(true);
      toast.success(`AI enabled (${data.chunks ?? 0} chunks indexed)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to scan note";
      toast.error(msg);
    } finally {
      setIndexing(false);
    }
  }, [noteId, onStateChange]);

  const disable = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}/scan`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onStateChange(false);
      setMessages([]);
      setSources([]);
      historyRef.current = [];
      toast.success("AI disabled for this note");
    } catch {
      toast.error("Failed to disable AI");
    }
  }, [noteId, onStateChange]);

  const ask = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;

    const history = historyRef.current;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    stickToBottomRef.current = true;
    scrollToBottom();

    try {
      const res = await fetch(`/api/notes/${noteId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get an answer");
      }
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
      setSources(data.sources ?? []);
      historyRef.current = [
        ...history,
        { role: "user", content: question },
        { role: "assistant", content: data.answer },
      ];
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to get an answer";
      setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading, noteId]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 sm:px-4 py-2.5 sm:py-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to note"
            className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <Sparkles className="h-5 w-5 sm:h-4 sm:w-4 text-yellow-400" />
        <span className="text-base sm:text-sm font-semibold">Ask AI</span>
        {aiEnabled && (
          <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 rounded-full px-2 py-0.5">
            Enabled
          </span>
        )}
        <div className="flex-1" />
        {aiEnabled ? (
          <button
            onClick={disable}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Disable
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={indexing}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50 transition-colors"
          >
            {indexing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {indexing ? "Indexing..." : "Enable AI"}
          </button>
        )}
      </div>

      {!aiEnabled ? (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-base sm:text-sm text-muted-foreground">
            Enable AI to scan this note and ask questions about its contents.
            Chunks are embedded with Cohere and stored in pgvector.
          </p>
        </div>
      ) : (
        <>
          <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 pt-2 pb-3 space-y-3"
          >
            {messages.length === 0 && (
              <p className="text-base sm:text-sm text-muted-foreground">
                Ask a question about this note.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-base sm:text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="ai-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {sources.length > 0 && !loading && (
              <div className="border-t border-border pt-2">
                <p className="px-1 pb-1.5 text-xs sm:text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Sources — click to jump
                </p>
                <div className="space-y-1">
                  {sources.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSourceClick?.(s.content)}
                      title="Jump to this section"
                      className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="mt-0.5 flex h-5 w-5 sm:h-4 sm:w-4 shrink-0 items-center justify-center rounded bg-muted text-xs sm:text-[10px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm sm:text-xs leading-relaxed text-foreground/80">
                          {s.content}
                        </span>
                        <span className="mt-0.5 block text-xs sm:text-[10px] tabular-nums text-muted-foreground/60">
                          {Math.round(Number(s.similarity) * 100)}% relevant
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {showScrollButton && (
            <button
              type="button"
              onClick={() => {
                stickToBottomRef.current = true;
                scrollToBottom();
              }}
              aria-label="Scroll to bottom"
              className="absolute bottom-3 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
          )}
          </div>

          <div className="border-t border-border px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder="Ask about this note..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 sm:py-2 text-base sm:text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                disabled={loading}
              />
              <button
                onClick={ask}
                disabled={!input.trim() || loading}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-3.5 sm:px-3 py-2 text-primary-foreground hover:bg-primary/80 disabled:opacity-50 transition-colors"
              >
                <Send className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
