"use client";

import { Node } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Check, X } from "lucide-react";
import dynamic from "next/dynamic";

const ExcalidrawWrapper = dynamic(
  () => import("@/components/excalidraw-wrapper"),
  { ssr: false },
);

interface DrawingData {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  svgPreview: string | null;
}

interface ExcalidrawAPI {
  getSceneElements(): unknown[];
  getAppState(): Record<string, unknown>;
  getFiles(): Record<string, unknown>;
}

function DrawingNodeView({
  node,
  updateAttributes,
  deleteNode,
}: ReactNodeViewProps) {
  const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
  const { strokes: strokesJson } = node.attrs as { strokes: string };

  let drawingData: DrawingData = {
    elements: [],
    appState: {},
    files: {},
    svgPreview: null,
  };
  let isLegacy = false;

  try {
    const parsed = JSON.parse(strokesJson || "{}");
    if (Array.isArray(parsed)) {
      isLegacy = true;
    } else {
      drawingData = parsed as DrawingData;
    }
  } catch {
    isLegacy = true;
  }

  const isEmpty =
    !drawingData.elements || drawingData.elements.length === 0;
  const hasContent =
    (!isEmpty && drawingData.svgPreview) || isLegacy;

  const [isEditing, setIsEditing] = useState(isEmpty && !isLegacy);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!excalidrawAPIRef.current || isSaving) return;
    setIsSaving(true);

    const elements = excalidrawAPIRef.current.getSceneElements();
    const rawAppState = {
      ...excalidrawAPIRef.current.getAppState(),
    } as Record<string, unknown>;
    delete rawAppState.collaborators;
    const appState = rawAppState;
    const files = excalidrawAPIRef.current.getFiles();

    let svgPreview: string | null = null;

    if (elements && elements.length > 0) {
      try {
        const { exportToSvg } = await import("@excalidraw/excalidraw");
        const svg = await exportToSvg({
          elements: (elements as { isDeleted?: boolean }[]).filter(
            (el) => !el.isDeleted,
          ),
          appState: {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: "#ffffff",
          },
          files,
          exportPadding: 10,
        });
        svgPreview = new XMLSerializer().serializeToString(svg);
      } catch (err) {
        console.error("Failed to generate SVG preview", err);
      }
    }

    updateAttributes({
      strokes: JSON.stringify({
        elements,
        appState,
        files,
        svgPreview,
      }),
    });
    setIsEditing(false);
    setIsSaving(false);
  }, [updateAttributes, isSaving]);

  const handleCancel = useCallback(() => {
    if (isEmpty) {
      deleteNode();
    } else {
      setIsEditing(false);
    }
  }, [isEmpty, deleteNode]);

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  if (isEditing) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50 shrink-0">
          <span className="text-sm font-medium">Drawing</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 h-7 rounded-md px-3 text-xs font-medium border border-border bg-background text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 h-7 rounded-md px-3 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Done
            </button>
          </div>
        </div>
        <div className="flex-1">
          {(() => {
            const safeAppState = {
              ...drawingData.appState,
            } as Record<string, unknown>;
            delete safeAppState.collaborators;
            return (
              <ExcalidrawWrapper
                initialData={{
                  elements: drawingData.elements,
                  appState: safeAppState,
                  files: drawingData.files,
                }}
                excalidrawAPI={(api: ExcalidrawAPI) => {
                  excalidrawAPIRef.current = api;
                }}
                UIOptions={{
                  canvasActions: {
                    changeViewBackgroundColor: false,
                    clearCanvas: false,
                    export: { saveFileToDisk: false },
                    loadScene: false,
                    saveToActiveFile: false,
                    toggleTheme: false,
                  },
                }}
                autoFocus
                handleKeyboardGlobally
                theme={isDark ? "dark" : "light"}
              />
            );
          })()}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <NodeViewWrapper>
      <div className="drawing-block">
        {hasContent ? (
          isLegacy ? (
            <div className="relative group border border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                Legacy drawing — not supported in the new editor
              </p>
              <button
                type="button"
                onClick={deleteNode}
                className="inline-flex items-center gap-1.5 h-7 rounded-md px-3 text-xs font-medium border border-border bg-background text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          ) : (
            <div
              className="relative group cursor-pointer border border-border rounded-lg overflow-hidden"
              contentEditable={false}
              onDoubleClick={() => setIsEditing(true)}
            >
              {drawingData.svgPreview && (
                <div
                  dangerouslySetInnerHTML={{
                    __html: drawingData.svgPreview,
                  }}
                  className="w-full [&>svg]:w-full [&>svg]:h-auto"
                />
              )}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="h-7 w-7 rounded-md bg-background/80 border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  title="Edit drawing"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={deleteNode}
                  className="h-7 w-7 rounded-md bg-background/80 border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Delete drawing"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        ) : (
          <div
            className="border border-border rounded-lg p-8 text-center text-muted-foreground text-sm cursor-pointer hover:bg-muted/50 transition-colors"
            onDoubleClick={() => setIsEditing(true)}
          >
            Double-click to start drawing
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const DrawingExtension = Node.create({
  name: "drawing",
  group: "block",
  atom: true,
  inline: false,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      width: { default: 800 },
      height: { default: 500 },
      strokes: { default: "{}" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="drawing"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, height, strokes } = HTMLAttributes;
    return [
      "div",
      {
        "data-type": "drawing",
        "data-width": width,
        "data-height": height,
        "data-strokes": strokes,
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingNodeView);
  },
});
