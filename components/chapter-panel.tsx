"use client";

import { type Editor } from "@tiptap/react";
import { X, ListTree, Heading1 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

interface ChapterPanelProps {
  editor: Editor | null;
  headings: HeadingItem[];
  activeHeadingId: string | null;
  onClose: () => void;
}

export function ChapterPanel({
  editor,
  headings,
  activeHeadingId,
  onClose,
}: ChapterPanelProps) {
  const navigateTo = (pos: number) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .scrollIntoView()
      .run();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-64 flex-col border-l border-amber-200/70 bg-background/95 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 border-b border-amber-200/70 px-4 py-3">
        <ListTree className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold">Chapters</span>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-stone-500 hover:bg-amber-200/50 hover:text-stone-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {headings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Heading1 className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No headings yet</p>
            <p className="text-[10px] text-muted-foreground/60">
              Use H1, H2, or H3 to create chapters
            </p>
          </div>
        ) : (
          headings.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => navigateTo(h.pos)}
              className={cn(
                "flex w-full items-center rounded-md py-1.5 text-left text-xs transition-colors hover:bg-amber-100/60",
                activeHeadingId === h.id
                  ? "bg-amber-200/70 font-semibold text-amber-900"
                  : "text-muted-foreground",
                h.level === 1 && "pl-2 font-semibold",
                h.level === 2 && "pl-6",
                h.level === 3 && "pl-10"
              )}
            >
              <span className="truncate">{h.text || "Untitled"}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
