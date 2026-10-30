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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distanceFromBottom >= 80);
  }, []);

  const handleScroll = useCallback(() => {
    updateScrollState();
  }, [updateScrollState]);

  useEffect(() => {
    updateScrollState();
  }, [messages, sources, loading, updateScrollState]);

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
    <div className="flex h-full flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-amber-200/70 px-3 py-2.5 sm:px-4 sm:py-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to note"
            className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-amber-200/50 hover:text-stone-900 sm:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <Sparkles className="h-5 w-5 sm:h-4 sm:w-4 text-amber-500" />
        <span className="text-base sm:text-sm font-semibold">Ask AI</span>
        {aiEnabled && (
          <span className="text-[10px] font-medium rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-800 dark:text-amber-300">
            Enabled
          </span>
        )}
        <div className="flex-1" />
        {aiEnabled ? (
          <button
            onClick={disable}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-stone-500 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Disable
          </button>
        ) : (
          <button
            onClick={enable}
            disabled={indexing}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/85 disabled:opacity-50 transition-colors"
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
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-base sm:text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "sunny-panel"
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
                <div className="rounded-2xl sunny-panel px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {sources.length > 0 && !loading && (
              <div className="border-t border-amber-200/60 pt-2">
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
                      className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-amber-100/60"
                    >
                      <span className="mt-0.5 flex h-5 w-5 sm:h-4 sm:w-4 shrink-0 items-center justify-center rounded-full bg-amber-200/70 text-xs font-semibold text-amber-900 sm:text-[10px]">
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
          </div>

          {showScrollButton && (
            <button
              type="button"
              onClick={() => {
                scrollToBottom();
              }}
              aria-label="Scroll to bottom"
              className="absolute bottom-3 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/70 bg-background text-stone-500 shadow-md transition-colors hover:bg-amber-200/50 hover:text-stone-900"
            >
              <ArrowDown className="h-5 w-5" />
            </button>
          )}
          </div>

          <div className="border-t border-amber-200/70 px-4 py-3">
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
                className="flex-1 rounded-full border border-amber-200/80 bg-white/50 px-4 py-2.5 text-base text-stone-800 outline-none placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 sm:py-2 sm:text-sm"
                disabled={loading}
              />
              <button
                onClick={ask}
                disabled={!input.trim() || loading}
                className="inline-flex items-center justify-center rounded-full bg-primary px-3.5 py-2 text-primary-foreground shadow-sm transition-colors hover:bg-primary/85 disabled:opacity-50 sm:px-3"
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
