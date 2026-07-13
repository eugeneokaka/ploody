"use client";

import { Node } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type ReactNodeViewProps,
} from "@tiptap/react";
import { useCallback, useState } from "react";
import { Pencil } from "lucide-react";
import { DrawingCanvas } from "@/components/drawing-canvas";
import { strokeToSvgPath, type Stroke } from "@/lib/drawing-utils";

function DrawingNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { width, height, strokes: strokesJson } = node.attrs as {
    width: number;
    height: number;
    strokes: string;
  };
  const strokes: Stroke[] = JSON.parse(strokesJson || "[]");

  const handleSave = useCallback(
    (newStrokes: Stroke[]) => {
      updateAttributes({ strokes: JSON.stringify(newStrokes) });
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
          initialStrokes={strokes}
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
          {strokes.map((stroke, i) => (
            <path
              key={i}
              d={strokeToSvgPath(stroke)}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>

        <button
          type="button"
          className="absolute top-2 right-2 h-7 w-7 rounded-md bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-muted"
          onClick={() => setIsEditing(true)}
          title="Edit drawing"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {strokes.length === 0 && (
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
