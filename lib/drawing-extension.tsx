"use client";

import { Node } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { useCallback, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { DrawingCanvas } from "@/components/drawing-canvas";
import {
  strokeToSvgPath,
  normalizeElements,
  type CanvasElement,
} from "@/lib/drawing-utils";

function DrawingNodeView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { width, height, strokes: strokesJson } = node.attrs as {
    width: number;
    height: number;
    strokes: string;
  };
  const elements: CanvasElement[] = normalizeElements(
    JSON.parse(strokesJson || "[]"),
  );

  const handleSave = useCallback(
    (newElements: CanvasElement[]) => {
      updateAttributes({ strokes: JSON.stringify(newElements) });
      setIsEditing(false);
    },
    [updateAttributes],
  );

  if (isEditing) {
    return (
      <NodeViewWrapper>
        <DrawingCanvas
          width={width}
          height={height}
          initialStrokes={elements}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        className="drawing-block my-4 relative group cursor-pointer select-none"
        contentEditable={false}
        onDoubleClick={() => setIsEditing(true)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full border border-border rounded-lg bg-white"
          style={{ aspectRatio: `${width}/${height}` }}
        >
          {elements.map((el, i) => {
            if (el.kind === "stroke") {
              return (
                <path
                  key={i}
                  d={strokeToSvgPath(el)}
                  fill="none"
                  stroke={el.color}
                  strokeWidth={el.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            if (el.kind === "rect") {
              return (
                <rect
                  key={i}
                  x={el.x}
                  y={el.y}
                  width={el.w}
                  height={el.h}
                  fill="none"
                  stroke={el.color}
                  strokeWidth={el.width}
                />
              );
            }
            if (el.kind === "circle") {
              return (
                <circle
                  key={i}
                  cx={el.cx}
                  cy={el.cy}
                  r={el.r}
                  fill="none"
                  stroke={el.color}
                  strokeWidth={el.width}
                />
              );
            }
            if (el.kind === "text") {
              return (
                <text
                  key={i}
                  x={el.x + 4}
                  y={el.y + el.fontSize}
                  fill={el.color}
                  fontSize={el.fontSize}
                  fontFamily="sans-serif"
                >
                  {el.text.split("\n").map((line, li) => (
                    <tspan key={li} x={el.x + 4} dy={li === 0 ? 0 : el.fontSize * 1.4}>
                      {line}
                    </tspan>
                  ))}
                </text>
              );
            }
            return null;
          })}
        </svg>

        <button
          type="button"
          className="absolute top-2 right-2 h-7 w-7 rounded-md bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-muted"
          onClick={() => setIsEditing(true)}
          title="Edit drawing"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="absolute top-2 right-11 h-7 w-7 rounded-md bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-destructive/10 hover:text-destructive"
          onClick={deleteNode}
          title="Delete drawing"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {elements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm pointer-events-none">
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
      strokes: { default: "[]" },
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
