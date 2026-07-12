"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, FolderOpen, CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "note" | "folder";
  title: string;
  folderId: string | null;
  snippet: string | null;
}

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
      if (open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
        }
        if (e.key === "Enter" && results[selectedIndex]) {
          e.preventDefault();
          handleSelect(results[selectedIndex]);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery("");
    if (result.type === "folder") {
      router.push(`/folders/${result.id}`);
    } else {
      router.push(`/notes/${result.id}`);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search notes and folders..."
          className="h-8 pl-9 pr-10 text-sm"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Searching...
            </div>
          ) : results.length === 0 && query.trim() ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            <div className="py-1">
              {results.map((result, i) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                    i === selectedIndex ? "bg-muted" : "hover:bg-muted/50"
                  )}
                >
                  {result.type === "folder" ? (
                    <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {result.title || "Untitled"}
                      </span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {result.type}
                      </span>
                    </div>
                    {result.snippet && (
                      <p
                        className="mt-0.5 line-clamp-1 text-xs text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                      />
                    )}
                  </div>
                  {i === selectedIndex && (
                    <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && query.trim() && (
            <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
              <kbd className="font-mono">↑↓</kbd> navigate{" "}
              <kbd className="font-mono">↵</kbd> open{" "}
              <kbd className="font-mono">esc</kbd> close
            </div>
          )}
        </div>
      )}
    </div>
  );
}
