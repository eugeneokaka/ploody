"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
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
}: {
  noteId: string;
  aiEnabled: boolean;
  onStateChange: (enabled: boolean) => void;
  onSourceClick?: (content: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const historyRef = useRef<Message[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="h-4 w-4 text-yellow-400" />
        <span className="text-sm font-semibold">Ask AI</span>
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
          <p className="text-sm text-muted-foreground">
            Enable AI to scan this note and ask questions about its contents.
            Chunks are embedded with Cohere and stored in pgvector.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask a question about this note.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="ai-markdown">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
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
              <div className="border-t border-border pt-2 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Sources (click to jump)
                </p>
                {sources.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onSourceClick?.(s.content)}
                    className="block w-full rounded px-1 py-0.5 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    · {s.content}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
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
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                disabled={loading}
              />
              <button
                onClick={ask}
                disabled={!input.trim() || loading}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/80 disabled:opacity-50 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
