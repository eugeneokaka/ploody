"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PublicNote {
  id: string;
  title: string;
  snippet: string | null;
}

const TILTS = [
  "-rotate-1",
  "rotate-1",
  "-rotate-[1deg]",
  "rotate-[1deg]",
];

export default function ExplorePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/public/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setHasSearched(true);
    } catch {
      setResults([]);
      setHasSearched(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-200/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-200">
          Community board
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          Explore
        </h1>
        <p className="mt-2 text-stone-500 dark:text-stone-400">
          Search public notes shared by the community
        </p>
      </div>

      <div className="relative mb-8 rounded-full sunny-panel p-1 shadow-sm backdrop-blur">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-700/70" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search public notes..."
          className="h-11 rounded-full border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
          autoFocus
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-8 text-sm text-stone-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          Searching...
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="sticky-note-soft tape-accent mx-auto w-full max-w-md rounded-[6px] px-6 py-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-amber-500/60" />
          <p className="mt-3 text-sm text-stone-600">
            No public notes found for &quot;{query}&quot;
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-4 pt-2">
          {results.map((note, index) => (
            <button
              key={note.id}
              onClick={() => router.push(`/share/${note.id}`)}
              className={cn(
                "sticky-note-soft tape-accent flex w-full items-start gap-4 rounded-[6px] p-4 pt-6 text-left transition-all duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-[0_20px_32px_-18px_rgba(41,37,36,0.55)]",
                TILTS[index % TILTS.length]
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-900/10 text-stone-700">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-stone-900">
                    {note.title || "Untitled"}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                </div>
                {note.snippet && (
                  <p
                    className="mt-1 line-clamp-2 text-sm text-stone-600"
                    dangerouslySetInnerHTML={{ __html: note.snippet }}
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
