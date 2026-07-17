"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { DrawingExtension } from "@/lib/drawing-extension";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadButton, uploadFiles } from "@/lib/uploadthing";

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
  const isSelfUpdate = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    ],
    content: content ? JSON.parse(content) : undefined,
    onUpdate: ({ editor }) => {
      isSelfUpdate.current = true;
      onChange?.(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class:
          "tiptap focus:outline-none min-h-[400px] max-w-3xl mx-auto px-8 py-6",
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

  if (!editor) return null;

  return (
    <div className="flex flex-col">
      <div className="sticky top-14 z-40 border-b border-border bg-background">
        <div className="flex flex-wrap items-center gap-1 px-4 py-2">
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
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setParagraph().run()}
            active={editor.isActive("paragraph")}
            title="Paragraph"
          >
            <Pilcrow className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
          >
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
          >
            <Strikethrough className="h-4 w-4" />
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
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
          >
            <Code className="h-4 w-4" />
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
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={addImage}>
            <Image className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().insertContent({ type: "drawing" }).run()
            }
            title="Add drawing"
          >
            <PenLine className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          <div className="flex items-center gap-1">
            <UploadButton
              endpoint="imageUploader"
              onClientUploadComplete={(res) => {
                if (res?.[0]?.url) {
                  editor.chain().focus().setImage({ src: res[0].url }).run();
                }
              }}
              onUploadError={(error: Error) => {
                alert(`Upload failed: ${error.message}`);
              }}
              appearance={{
                button:
                  "inline-flex items-center gap-1.5 h-7 rounded-md px-2 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-0 cursor-pointer",
                allowedContent: "hidden",
              }}
            />
          </div>
        </div>
      </div>

      <EditorContent editor={editor} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
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
