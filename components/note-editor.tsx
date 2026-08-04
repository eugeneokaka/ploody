"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { DrawingExtension } from "@/lib/drawing-extension";
import { YoutubeExtension, extractYoutubeId } from "@/lib/youtube-extension";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Undo2,
  Redo2,
  Image,
  Link2,
  Palette,
  Pilcrow,
  RemoveFormatting,
  PenLine,
  Search,
  ListTree,
  ChevronUp,
  ChevronDown,
  X,
  Eraser,
  Video,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadFiles } from "@/lib/uploadthing";
import { ChapterPanel, type HeadingItem } from "@/components/chapter-panel";
import { toast } from "sonner";

const fontFamilies = [
  { label: "Default", value: "var(--font-sans)" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "var(--font-geist-mono)" },
];

const textColors = [
  "#1a1a1a", "#4a4a4a", "#666666", "#999999",
  "#e53e3e", "#dd6b20", "#d69e2e", "#facc15",
  "#38a169", "#319795", "#3182ce", "#5a67d8",
  "#805ad5", "#d53f8c",
];

interface NoteEditorProps {
  content?: string;
  onChange?: (json: string) => void;
}

export function NoteEditor({ content, onChange }: NoteEditorProps) {
  const [showColors, setShowColors] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const isSelfUpdate = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false },
        underline: {},
      }),
      TextStyle,
      Color,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      ImageExtension.configure({
        allowBase64: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
      DrawingExtension,
      YoutubeExtension,
    ],
    content: content ? JSON.parse(content) : undefined,
    onUpdate: ({ editor }) => {
      isSelfUpdate.current = true;
      onChange?.(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class:
          "tiptap focus:outline-none min-h-[400px] max-w-3xl mx-auto px-4 sm:px-8 py-6",
      },
      handlePaste: (_view, event, slice) => {
        const plainText = event.clipboardData?.getData("text/plain")?.trim();
        if (plainText && extractYoutubeId(plainText)) {
          const { tr } = _view.state;
          _view.dispatch(
            tr
              .replaceSelectionWith(
                _view.state.schema.nodes.youtube.create({
                  url: plainText,
                  videoId: extractYoutubeId(plainText),
                })
              )
              .scrollIntoView()
          );
          return true;
        }

        let emptyCount = 0;
        slice.content.descendants((node) => {
          if (
            (node.type.name === "paragraph" ||
              node.type.name === "codeBlock") &&
            node.textContent.trim().length === 0
          ) {
            emptyCount++;
          }
        });
        if (emptyCount > 0) {
          toast.info(
            `Pasted content has ${emptyCount} blank ${emptyCount === 1 ? "line" : "lines"}. Use the Strip button to remove them.`,
            { duration: 5000, position: "top-center" }
          );
        }
        return false;
      },
      transformPastedHTML: (html: string) => {
        const doc = new DOMParser().parseFromString(html, "text/html");

        doc.querySelectorAll("pre").forEach((pre) => {
          pre.innerHTML = pre.innerHTML.trim();

          const code = pre.querySelector("code");
          if (code) {
            code.textContent = (code.textContent ?? "").replace(/\n+$/, "");
          }
        });

        return doc.body.innerHTML;
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor || !content) return;
    if (isSelfUpdate.current) {
      isSelfUpdate.current = false;
      return;
    }
    const currentJson = JSON.stringify(editor.getJSON());
    if (currentJson !== content) {
      editor.commands.setContent(JSON.parse(content));
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const items: HeadingItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          items.push({
            id: `h-${pos}`,
            level: node.attrs.level,
            text: node.textContent,
            pos,
          });
        }
      });
      setHeadings(items);

      const cursorPos = editor.state.selection.from;
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].pos <= cursorPos) {
          setActiveHeadingId(items[i].id);
          return;
        }
      }
      setActiveHeadingId(items.length > 0 ? items[0].id : null);
    };

    editor.on("update", updateHeadings);
    editor.on("selectionUpdate", updateHeadings);
    updateHeadings();

    return () => {
      editor.off("update", updateHeadings);
      editor.off("selectionUpdate", updateHeadings);
    };
  }, [editor]);

  const findMatches = useMemo(() => {
    if (!editor || !searchQuery) return [];
    const results: {
      from: number;
      to: number;
      before: string;
      matchText: string;
      after: string;
    }[] = [];
    const queryLower = searchQuery.toLowerCase();
    const doc = editor.state.doc;
    const CONTEXT = 30;

    doc.descendants((node, pos) => {
      if (node.isText) {
        const text = node.text ?? "";
        const textLower = text.toLowerCase();
        let start = 0;
        while ((start = textLower.indexOf(queryLower, start)) !== -1) {
          const from = pos + 1 + start;
          const to = from + searchQuery.length;
          const contextStart = Math.max(0, from - 1 - CONTEXT);
          const contextEnd = Math.min(doc.content.size, to - 1 + CONTEXT);
          const before = doc
            .textBetween(contextStart, from - 1, " ", " ")
            .replace(/\n/g, " ")
            .trimStart();
          const after = doc
            .textBetween(to - 1, contextEnd, " ", " ")
            .replace(/\n/g, " ")
            .trimEnd();
          results.push({
            from,
            to,
            before,
            matchText: text.substring(start, start + searchQuery.length),
            after,
          });
          start += searchQuery.length;
        }
      }
    });
    return results;
  }, [editor, searchQuery]);

  const scrollToPosition = useCallback(
    (pos: number) => {
      if (!editor) return;
      try {
        const resolved = editor.view.domAtPos(pos);
        const el =
          resolved.node instanceof HTMLElement
            ? resolved.node
            : resolved.node.parentElement;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        // position may be invalid after doc changes
      }
    },
    [editor]
  );

  const navigateToMatch = useCallback(
    (index: number) => {
      if (findMatches.length === 0) return;
      const i = ((index % findMatches.length) + findMatches.length) % findMatches.length;
      setCurrentMatch(i);
      scrollToPosition(findMatches[i].from);
    },
    [findMatches, scrollToPosition]
  );

  useEffect(() => {
    if (searchQuery && findMatches.length > 0) {
      setCurrentMatch(0);
      scrollToPosition(findMatches[0].from);
    }
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowFind(true);
        setTimeout(() => findInputRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      navigateToMatch(
        e.shiftKey ? currentMatch - 1 : currentMatch + 1
      );
    }
    if (e.key === "Escape") {
      setShowFind(false);
      setSearchQuery("");
      editor?.commands.focus();
    }
  };

  const closeFind = () => {
    setShowFind(false);
    setSearchQuery("");
    editor?.commands.focus();
  };

  const stripBlankLines = useCallback(() => {
    if (!editor) return;
    const { state, view } = editor;
    const tr = state.tr;

    const toRemove: { from: number; to: number }[] = [];

    state.doc.descendants((node, pos) => {
      if (
        node.type.name === "paragraph" ||
        node.type.name === "codeBlock"
      ) {
        if (node.textContent.trim().length === 0) {
          toRemove.push({ from: pos, to: pos + node.nodeSize });
        }
      }
    });

    for (let i = toRemove.length - 1; i >= 0; i--) {
      tr.delete(toRemove[i].from, toRemove[i].to);
    }

    if (tr.steps.length > 0) {
      view.dispatch(tr);
    }
  }, [editor]);

  const handleStrip = useCallback(() => {
    if (!editor) return;
    if (!window.confirm("This will remove all blank lines and empty code blocks from the document. Continue?")) return;
    stripBlankLines();
  }, [editor, stripBlankLines]);

  const addImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;

      try {
        const [res] = await uploadFiles("imageUploader", { files: [file] });
        editor.chain().focus().setImage({ src: res.ufsUrl }).run();
      } catch {
        alert("Upload failed. Please try again.");
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [editor]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Enter YouTube URL:");
    if (!url) return;
    const videoId = extractYoutubeId(url.trim());
    if (!videoId) {
      alert("Invalid YouTube URL");
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "youtube",
        attrs: { url: url.trim(), videoId },
      })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col">
      <div className="sticky top-14 z-40 border-b border-border bg-background">
        <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 px-2 sm:px-4 py-1.5 sm:py-2">
          <div className="flex items-center gap-0.5 border-r border-border pr-2 mr-2">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
            >
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
            >
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
          >
            <Heading1 className="h-4 w-4 text-amber-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
          >
            <Heading2 className="h-4 w-4 text-amber-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
          >
            <Heading3 className="h-4 w-4 text-amber-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setParagraph().run()}
            active={editor.isActive("paragraph")}
            title="Paragraph"
          >
            <Pilcrow className="h-4 w-4 text-amber-400" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
          >
            <Bold className="h-4 w-4 text-sky-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
          >
            <Italic className="h-4 w-4 text-sky-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
          >
            <UnderlineIcon className="h-4 w-4 text-sky-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
          >
            <Strikethrough className="h-4 w-4 text-sky-400" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <div className="relative">
            <ToolbarButton
              onClick={() => setShowColors(!showColors)}
              active={Boolean(editor.getAttributes("textStyle").color)}
            >
              <Palette className="h-4 w-4" />
            </ToolbarButton>
            {showColors && (
              <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover p-2 shadow-md">
                <div className="flex flex-wrap gap-1.5 w-[196px]">
                  {textColors.map((color) => (
                    <button
                      key={color}
                      className="h-6 w-6 rounded-md border border-border"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        editor.chain().focus().setColor(color).run();
                        setShowColors(false);
                      }}
                    />
                  ))}
                  <button
                    className="h-6 w-6 rounded-md border border-border bg-transparent"
                    onClick={() => {
                      editor.chain().focus().unsetColor().run();
                      setShowColors(false);
                    }}
                  >
                    <span className="text-xs">/</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
          >
            <List className="h-4 w-4 text-emerald-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
          >
            <ListOrdered className="h-4 w-4 text-emerald-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
          >
            <Quote className="h-4 w-4 text-emerald-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
          >
            <Code className="h-4 w-4 text-emerald-400" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().clearNodes().unsetAllMarks().run()
            }
            title="Clear formatting"
          >
            <RemoveFormatting className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton onClick={setLink} active={editor.isActive("link")}>
            <Link2 className="h-4 w-4 text-blue-400" />
          </ToolbarButton>
          <ToolbarButton onClick={addImage}>
            <Image className="h-4 w-4 text-emerald-400" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().insertContent({ type: "drawing" }).run()
            }
            title="Add drawing"
          >
            <PenLine className="h-4 w-4 text-violet-400" />
          </ToolbarButton>
          <ToolbarButton onClick={addYoutube} title="Add YouTube video">
            <Video className="h-4 w-4 text-red-400" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton onClick={addImage} title="Upload image">
            <Upload className="h-4 w-4 text-indigo-400" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <button
            type="button"
            onClick={handleStrip}
            title="Remove blank lines and empty code blocks"
            className="inline-flex items-center gap-1.5 h-7 rounded-md px-2 text-xs font-medium bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Eraser className="h-3.5 w-3.5 text-rose-400" />
            <span className="hidden sm:inline">Strip</span>
          </button>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => {
              setShowFind(!showFind);
              if (!showFind) setTimeout(() => findInputRef.current?.focus(), 0);
            }}
            active={showFind}
            title="Find in note (Ctrl+F)"
          >
            <Search className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setShowChapters(!showChapters)}
            active={showChapters}
            title="Chapters outline"
          >
            <ListTree className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {showFind && (
          <div className="relative border-t border-border">
            <div className="flex items-center gap-2 px-4 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={findInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleFindKeyDown}
                placeholder="Find in note..."
                className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {findMatches.length > 0 ? currentMatch + 1 : 0}/{findMatches.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigateToMatch(currentMatch - 1)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToMatch(currentMatch + 1)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={closeFind}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {searchQuery && findMatches.length > 0 && (
              <div className="max-h-48 overflow-y-auto border-t border-border">
                {findMatches.map((match, i) => (
                  <button
                    key={`${match.from}-${match.to}`}
                    type="button"
                    onClick={() => navigateToMatch(i)}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                      i === currentMatch && "bg-muted"
                    )}
                  >
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
                      {i + 1}
                    </span>
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground/60">
                        {match.before}
                      </span>
                      <span className="font-medium text-foreground">
                        {match.matchText}
                      </span>
                      <span className="text-muted-foreground/60">
                        {match.after}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <EditorContent editor={editor} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {showChapters && (
        <ChapterPanel
          editor={editor}
          headings={headings}
          activeHeadingId={activeHeadingId}
          onClose={() => setShowChapters(false)}
        />
      )}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30",
        active && "bg-muted text-foreground"
      )}
    >
      {children}
    </button>
  );
}
