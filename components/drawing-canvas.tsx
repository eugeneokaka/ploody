"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Undo2, Check, X, Eraser, PenLine, Square, Circle, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasElement, FreehandStroke } from "@/lib/drawing-utils";

const COLORS = [
  "#1a1a1a", "#4a4a4a", "#666666", "#999999",
  "#e53e3e", "#dd6b20", "#d69e2e", "#facc15",
  "#38a169", "#319795", "#3182ce", "#5a67d8",
  "#805ad5", "#d53f8c",
];

const WIDTHS = [1, 2, 3, 4, 6, 8];

type Tool = "pen" | "eraser" | "rect" | "circle" | "text";

interface DrawingCanvasProps {
  width: number;
  height: number;
  initialStrokes: CanvasElement[];
  onSave: (elements: CanvasElement[]) => void;
  onCancel: () => void;
}

export function DrawingCanvas({
  width,
  height,
  initialStrokes,
  onSave,
  onCancel,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const elementsRef = useRef<CanvasElement[]>(initialStrokes);
  const currentStrokeRef = useRef<FreehandStroke | null>(null);
  const currentColorRef = useRef("#1a1a1a");
  const currentWidthRef = useRef(3);
  const toolRef = useRef<Tool>("pen");
  const shapeStartRef = useRef<[number, number] | null>(null);
  const shapePreviewRef = useRef<CanvasElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragRef = useRef<{
    el: CanvasElement & { kind: "text" };
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const isErasingRef = useRef(false);
  const eraserPointsRef = useRef<[number, number][]>([]);
  const mousePosRef = useRef<[number, number] | null>(null);
  const rafRef = useRef<number>(0);
  const drawAllRef = useRef<() => void>(() => {});

  const [currentColor, setCurrentColor] = useState("#1a1a1a");
  const [currentWidth, setCurrentWidth] = useState(3);
  const [elements, setElements] = useState<CanvasElement[]>(initialStrokes);
  const [undoStack, setUndoStack] = useState<CanvasElement[][]>([]);
  const [tool, setTool] = useState<Tool>("pen");

  useEffect(() => { currentColorRef.current = currentColor; }, [currentColor]);
  useEffect(() => { currentWidthRef.current = currentWidth; }, [currentWidth]);
  useEffect(() => {
    toolRef.current = tool;
    isErasingRef.current = tool === "eraser";
  }, [tool]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawAllRef.current();
    });
  }, []);

  const drawEraserCursor = useCallback(() => {
    if (!isErasingRef.current) return;
    const pos = mousePosRef.current;
    if (!pos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const radius = currentWidthRef.current * 4;
    ctx.save();
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(pos[0], pos[1], radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }, []);

  const drawElement = useCallback(
    (ctx: CanvasRenderingContext2D, el: CanvasElement) => {
      switch (el.kind) {
        case "stroke":
          if (el.points.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = el.color;
          ctx.lineWidth = el.width;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.moveTo(el.points[0][0], el.points[0][1]);
          for (let i = 1; i < el.points.length - 1; i++) {
            const [x1, y1] = el.points[i];
            const [x2, y2] = el.points[i + 1];
            ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
          }
          ctx.lineTo(el.points[el.points.length - 1][0], el.points[el.points.length - 1][1]);
          ctx.stroke();
          break;
        case "rect":
          ctx.beginPath();
          ctx.strokeStyle = el.color;
          ctx.lineWidth = el.width;
          ctx.strokeRect(el.x, el.y, el.w, el.h);
          break;
        case "circle":
          ctx.beginPath();
          ctx.strokeStyle = el.color;
          ctx.lineWidth = el.width;
          ctx.arc(el.cx, el.cy, el.r, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "text":
          if (!el.text) return;
          ctx.font = `${el.fontSize}px sans-serif`;
          ctx.fillStyle = el.color;
          const lines = el.text.split("\n");
          const lh = el.fontSize * 1.4;
          for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], el.x + 4, el.y + el.fontSize + i * lh);
          }
          break;
      }
    },
    [],
  );

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const el of elementsRef.current) {
      drawElement(ctx, el);
    }

    if (currentStrokeRef.current) {
      drawElement(ctx, currentStrokeRef.current);
    }

    if (shapePreviewRef.current) {
      ctx.save();
      ctx.setLineDash([5, 3]);
      drawElement(ctx, shapePreviewRef.current);
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawEraserCursor();
  }, [drawElement, drawEraserCursor]);

  useEffect(() => {
    drawAllRef.current = drawAll;
  });

  useEffect(() => {
    drawAll();
  }, [elements, drawAll]);

  const getPos = useCallback((e: PointerEvent): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (canvas.width / rect.width),
      (e.clientY - rect.top) * (canvas.height / rect.height),
    ];
  }, []);

  const hitTestText = useCallback(
    (px: number, py: number) => {
      for (let i = elementsRef.current.length - 1; i >= 0; i--) {
        const el = elementsRef.current[i];
        if (el.kind !== "text") continue;
        if (px >= el.x && px <= el.x + el.w && py >= el.y && py <= el.y + el.h) {
          return { el, index: i };
        }
      }
      return null;
    },
    [],
  );

  const distanceBetween = useCallback(
    (a: [number, number], b: [number, number]) =>
      Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2),
    [],
  );

  const splitStrokeByEraser = useCallback(
    (stroke: FreehandStroke, eraserPoints: [number, number][]) => {
      const radius = currentWidthRef.current * 5;
      const eroded = new Set<number>();
      for (let i = 0; i < stroke.points.length; i++) {
        for (const ep of eraserPoints) {
          if (distanceBetween(stroke.points[i], ep) <= radius) { eroded.add(i); break; }
        }
      }
      const segments: FreehandStroke[] = [];
      let seg: [number, number][] = [];
      for (let i = 0; i < stroke.points.length; i++) {
        if (!eroded.has(i)) seg.push(stroke.points[i]);
        else {
          if (seg.length >= 2) segments.push({ kind: "stroke", color: stroke.color, width: stroke.width, points: seg });
          seg = [];
        }
      }
      if (seg.length >= 2) segments.push({ kind: "stroke", color: stroke.color, width: stroke.width, points: seg });
      return segments;
    },
    [distanceBetween],
  );

  const eraserHitsRect = useCallback(
    (ep: [number, number][], radius: number, rect: { x: number; y: number; w: number; h: number }) => {
      const exp = Math.max(radius, 10);
      for (const p of ep) {
        if (p[0] >= rect.x - exp && p[0] <= rect.x + rect.w + exp && p[1] >= rect.y - exp && p[1] <= rect.y + rect.h + exp) return true;
      }
      return false;
    },
    [],
  );

  const trimRectByEraser = useCallback(
    (el: CanvasElement & { kind: "rect" }, ep: [number, number][], radius: number): CanvasElement[] | null => {
      const exp = radius;
      const hitAll = ep.every((p) =>
        p[0] >= el.x - exp && p[0] <= el.x + el.w + exp && p[1] >= el.y - exp && p[1] <= el.y + el.h + exp);
      if (hitAll) return null;
      return [el];
    },
    [],
  );

  const strikeStrokesWithEraser = useCallback(() => {
    const ep = eraserPointsRef.current;
    if (ep.length < 2) return;
    const result: CanvasElement[] = [];
    let changed = false;
    const radius = currentWidthRef.current * 5;

    for (const el of elementsRef.current) {
      if (el.kind === "rect") {
        const trimmed = trimRectByEraser(el, ep, radius);
        if (trimmed) { result.push(...trimmed); changed = true; }
        else changed = true;
      } else if (el.kind === "circle") {
        let hit = false;
        for (const p of ep) {
          if (distanceBetween(p, [el.cx, el.cy]) <= el.r + radius) { hit = true; break; }
        }
        if (hit) changed = true;
        else result.push(el);
      } else if (el.kind === "text") {
        if (eraserHitsRect(ep, radius, { x: el.x, y: el.y, w: el.w, h: el.h })) changed = true;
        else result.push(el);
      } else {
        const pieces = splitStrokeByEraser(el, ep);
        if (pieces.length === 0) { changed = true; continue; }
        if (pieces.length === 1 && pieces[0].points.length === el.points.length) result.push(el);
        else { result.push(...pieces); changed = true; }
      }
    }

    if (changed) {
      setUndoStack((prev) => [...prev, elementsRef.current]);
      elementsRef.current = result;
      setElements(result);
    }
    eraserPointsRef.current = [];
  }, [splitStrokeByEraser, distanceBetween, eraserHitsRect, trimRectByEraser]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const t = toolRef.current;

      if (t === "text") {
        const pos = getPos(e.nativeEvent);
        const text = window.prompt("Enter text:");
        if (text && text.trim()) {
          const newEl: CanvasElement = {
            kind: "text",
            x: pos[0],
            y: pos[1],
            w: 200,
            h: 60,
            text: text.trim(),
            fontSize: 18,
            color: currentColorRef.current,
          };
          setUndoStack((prev) => [...prev, elementsRef.current]);
          elementsRef.current = [...elementsRef.current, newEl];
          setElements(elementsRef.current);
        }
        return;
      }

      canvas.setPointerCapture(e.pointerId);
      const pos = getPos(e.nativeEvent);

      if (t === "eraser") {
        isDrawingRef.current = true;
        eraserPointsRef.current = [pos];
        scheduleDraw();
        return;
      }

      if (t === "rect" || t === "circle") {
        isDrawingRef.current = true;
        shapeStartRef.current = pos;
        shapePreviewRef.current = null;
        scheduleDraw();
        return;
      }

      if (t === "pen") {
        const hit = hitTestText(pos[0], pos[1]);
        if (hit) {
          isDraggingRef.current = true;
          dragRef.current = {
            el: hit.el,
            startX: pos[0],
            startY: pos[1],
            origX: hit.el.x,
            origY: hit.el.y,
          };
          return;
        }
      }

      isDrawingRef.current = true;
      currentStrokeRef.current = {
        kind: "stroke",
        color: currentColorRef.current,
        width: currentWidthRef.current,
        points: [pos],
      };
      scheduleDraw();
    },
    [getPos, scheduleDraw, hitTestText],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;
      const pos = getPos(e.nativeEvent);
      mousePosRef.current = pos;

      if (isDraggingRef.current && dragRef.current) {
        const dx = pos[0] - dragRef.current.startX;
        const dy = pos[1] - dragRef.current.startY;
        elementsRef.current = elementsRef.current.map((el) =>
          el === dragRef.current!.el ? { ...el, x: dragRef.current!.origX + dx, y: dragRef.current!.origY + dy } : el,
        );
        setElements(elementsRef.current);
        scheduleDraw();
        return;
      }

      if (t === "text") {
        scheduleDraw();
        return;
      }

      if (t === "eraser") {
        if (isDrawingRef.current) {
          eraserPointsRef.current = [...eraserPointsRef.current, pos];
        }
        scheduleDraw();
        return;
      }

      if ((t === "rect" || t === "circle") && isDrawingRef.current) {
        const start = shapeStartRef.current;
        if (!start) return;
        const [sx, sy] = start;
        const [ex, ey] = pos;
        if (t === "rect") {
          shapePreviewRef.current = { kind: "rect", color: currentColorRef.current, width: currentWidthRef.current, x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(ex - sx), h: Math.abs(ey - sy) };
        } else {
          const cx = (sx + ex) / 2, cy = (sy + ey) / 2, r = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2) / 2;
          shapePreviewRef.current = { kind: "circle", color: currentColorRef.current, width: currentWidthRef.current, cx, cy, r };
        }
        scheduleDraw();
        return;
      }

      if (!isDrawingRef.current || !currentStrokeRef.current) {
        scheduleDraw();
        return;
      }
      currentStrokeRef.current = {
        ...currentStrokeRef.current,
        points: [...currentStrokeRef.current.points, pos],
      };
      scheduleDraw();
    },
    [getPos, scheduleDraw],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const t = toolRef.current;

      if (isDraggingRef.current && dragRef.current) {
        const el = dragRef.current.el;
        const current = elementsRef.current.find(
          (elm) => elm.kind === "text" && elm.x !== undefined && elm === el,
        ) as (CanvasElement & { kind: "text" }) | undefined;
        if (current && (current.x !== el.x || current.y !== el.y)) {
          setUndoStack((prev) => [
            ...prev,
            elementsRef.current.map((elm) =>
              elm === el ? { ...elm, x: el.x, y: el.y } : elm,
            ),
          ]);
        }
        isDraggingRef.current = false;
        dragRef.current = null;
        canvasRef.current?.releasePointerCapture(e.pointerId);
        return;
      }

      canvasRef.current?.releasePointerCapture(e.pointerId);

      if (t === "text") return;

      if (t === "eraser" && isDrawingRef.current) {
        isDrawingRef.current = false;
        strikeStrokesWithEraser();
        drawAll();
        return;
      }

      if ((t === "rect" || t === "circle") && isDrawingRef.current) {
        isDrawingRef.current = false;
        const preview = shapePreviewRef.current;
        shapePreviewRef.current = null;
        shapeStartRef.current = null;
        if (preview) {
          setUndoStack((prev) => [...prev, elementsRef.current]);
          elementsRef.current = [...elementsRef.current, preview];
          setElements(elementsRef.current);
        }
        drawAll();
        return;
      }

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const completed = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (completed && completed.points.length > 1) {
        setUndoStack((prev) => [...prev, elementsRef.current]);
        elementsRef.current = [...elementsRef.current, completed];
        setElements(elementsRef.current);
      }
      drawAll();
    },
    [drawAll, strikeStrokesWithEraser],
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 && elementsRef.current.length === 0) return;
    const prev = undoStack[undoStack.length - 1] ?? [];
    setUndoStack((s) => s.slice(0, -1));
    elementsRef.current = prev;
    setElements(prev);
  }, [undoStack]);

  const handleTextDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const t = toolRef.current;
    if (t !== "pen" && t !== "text") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = hitTestText(px, py);
    if (!hit) return;
    const existing = hit.el.text;
    const text = window.prompt("Edit text:", existing);
    if (text === null || text.trim() === "") {
      if (existing) {
        const t2 = window.confirm("Delete this text?");
        if (t2) {
          setUndoStack((prev) => [...prev, elementsRef.current]);
          elementsRef.current = elementsRef.current.filter((elm) => elm !== hit.el);
          setElements(elementsRef.current);
        }
      }
      return;
    }
    setUndoStack((prev) => [...prev, elementsRef.current]);
    elementsRef.current = elementsRef.current.map((elm) =>
      elm === hit.el ? { ...elm, text: text.trim() } : elm,
    );
    setElements(elementsRef.current);
  }, [hitTestText]);

  const tools: { id: Tool; icon: React.ElementType; label: string }[] = [
    { id: "pen", icon: PenLine, label: "Pen" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "text", icon: Type, label: "Text" },
  ];

  return (
    <div className="flex flex-col gap-2" contentEditable={false}>
      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-0.5 border-r border-border pr-2 mr-1">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTool(id)}
              className={cn(
                "h-7 w-7 rounded-md inline-flex items-center justify-center transition-colors hover:bg-muted hover:text-foreground",
                tool === id ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {tool !== "eraser" && (
          <>
            <div className="flex items-center gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all",
                    currentColor === color ? "border-primary scale-110" : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setCurrentColor(color)}
                />
              ))}
            </div>
            <div className="mx-1 h-5 w-px bg-border" />
            <div className="flex items-center gap-1">
              {WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={cn(
                    "h-6 w-6 rounded-md flex items-center justify-center transition-colors",
                    currentWidth === w ? "bg-muted" : "hover:bg-muted",
                  )}
                  onClick={() => setCurrentWidth(w)}
                >
                  <div
                    className="rounded-full bg-foreground"
                    style={{ width: Math.max(2, w), height: Math.max(2, w) }}
                  />
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={handleUndo}
          disabled={undoStack.length === 0 && elements.length === 0}
          className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>

        <div className="flex-1" />

        <button type="button" onClick={onCancel} className="h-7 rounded-md px-2 text-xs font-medium inline-flex items-center gap-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
        <button type="button" onClick={() => onSave(elementsRef.current)} className="h-7 rounded-md px-2 text-xs font-medium inline-flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/80">
          <Check className="h-3.5 w-3.5" /> Done
        </button>
      </div>

      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={cn(
            "w-full border border-border rounded-lg bg-white touch-none select-none outline-none",
            tool === "eraser" ? "cursor-none" : "cursor-crosshair",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onDoubleClick={handleTextDoubleClick}
        />
      </div>
    </div>
  );
}
