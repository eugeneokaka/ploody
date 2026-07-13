"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Undo2, Check, X, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stroke } from "@/lib/drawing-utils";

const COLORS = [
  "#1a1a1a", "#4a4a4a", "#666666", "#999999",
  "#e53e3e", "#dd6b20", "#d69e2e", "#facc15",
  "#38a169", "#319795", "#3182ce", "#5a67d8",
  "#805ad5", "#d53f8c",
];

const WIDTHS = [1, 2, 3, 4, 6, 8];

interface DrawingCanvasProps {
  width: number;
  height: number;
  initialStrokes: Stroke[];
  onSave: (strokes: Stroke[]) => void;
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
  const isDrawingRef = useRef(false);
  const strokesRef = useRef<Stroke[]>(initialStrokes);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const currentColorRef = useRef("#1a1a1a");
  const currentWidthRef = useRef(3);
  const isErasingRef = useRef(false);
  const eraserPointsRef = useRef<[number, number][]>([]);
  const mousePosRef = useRef<[number, number] | null>(null);
  const rafRef = useRef<number>(0);

  const [currentColor, setCurrentColor] = useState("#1a1a1a");
  const [currentWidth, setCurrentWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [isErasing, setIsErasing] = useState(false);

  useEffect(() => {
    currentColorRef.current = currentColor;
  }, [currentColor]);

  useEffect(() => {
    currentWidthRef.current = currentWidth;
  }, [currentWidth]);

  useEffect(() => {
    isErasingRef.current = isErasing;
  }, [isErasing]);

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

  const distanceBetween = useCallback(
    (a: [number, number], b: [number, number]) => {
      return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
    },
    [],
  );

  const splitStrokeByEraser = useCallback(
    (stroke: Stroke, eraserPoints: [number, number][]) => {
      const radius = currentWidthRef.current * 5;
      const eroded = new Set<number>();

      for (let i = 0; i < stroke.points.length; i++) {
        for (const ep of eraserPoints) {
          if (distanceBetween(stroke.points[i], ep) <= radius) {
            eroded.add(i);
            break;
          }
        }
      }

      const segments: Stroke[] = [];
      let segment: [number, number][] = [];

      for (let i = 0; i < stroke.points.length; i++) {
        if (!eroded.has(i)) {
          segment.push(stroke.points[i]);
        } else {
          if (segment.length >= 2) {
            segments.push({ color: stroke.color, width: stroke.width, points: segment });
          }
          segment = [];
        }
      }

      if (segment.length >= 2) {
        segments.push({ color: stroke.color, width: stroke.width, points: segment });
      }

      return segments;
    },
    [distanceBetween],
  );

  const strikeStrokesWithEraser = useCallback(() => {
    const ep = eraserPointsRef.current;
    if (ep.length < 2) return;

    const result: Stroke[] = [];
    let changed = false;

    for (const stroke of strokesRef.current) {
      const pieces = splitStrokeByEraser(stroke, ep);
      if (pieces.length === 0) {
        changed = true;
        continue;
      }
      if (pieces.length === 1 && pieces[0].points.length === stroke.points.length) {
        result.push(stroke);
      } else {
        result.push(...pieces);
        changed = true;
      }
    }

    if (changed) {
      setUndoStack((prev) => [...prev, strokesRef.current]);
      strokesRef.current = result;
      setStrokes(result);
    }
    eraserPointsRef.current = [];
  }, [splitStrokeByEraser]);

  const drawStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const all = [...strokesRef.current];
    if (currentStrokeRef.current) {
      all.push(currentStrokeRef.current);
    }

    for (const stroke of all) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const [fx, fy] = stroke.points[0];
      ctx.moveTo(fx, fy);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const [x1, y1] = stroke.points[i];
        const [x2, y2] = stroke.points[i + 1];
        ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
      }

      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last[0], last[1]);
      ctx.stroke();
    }

    drawEraserCursor();
  }, [drawEraserCursor]);

  useEffect(() => {
    drawStrokes();
  }, [strokes, drawStrokes]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawStrokes();
    });
  }, [drawStrokes]);

  const getPos = useCallback((e: PointerEvent): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [
      (e.clientX - rect.left) * (canvas.width / rect.width),
      (e.clientY - rect.top) * (canvas.height / rect.height),
    ];
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;

      const pos = getPos(e.nativeEvent);

      if (isErasingRef.current) {
        eraserPointsRef.current = [pos];
      } else {
        currentStrokeRef.current = {
          color: currentColorRef.current,
          width: currentWidthRef.current,
          points: [pos],
        };
      }
      scheduleDraw();
    },
    [getPos, scheduleDraw],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) {
        mousePosRef.current = getPos(e.nativeEvent);
        scheduleDraw();
        return;
      }

      const pos = getPos(e.nativeEvent);
      mousePosRef.current = pos;

      if (isErasingRef.current) {
        eraserPointsRef.current = [...eraserPointsRef.current, pos];
      } else if (currentStrokeRef.current) {
        currentStrokeRef.current = {
          ...currentStrokeRef.current,
          points: [...currentStrokeRef.current.points, pos],
        };
      }
      scheduleDraw();
    },
    [getPos, scheduleDraw],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      canvasRef.current?.releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      if (isErasingRef.current) {
        strikeStrokesWithEraser();
      } else {
        const completed = currentStrokeRef.current;
        currentStrokeRef.current = null;
        if (completed && completed.points.length > 1) {
          setUndoStack((prev) => [...prev, strokesRef.current]);
          strokesRef.current = [...strokesRef.current, completed];
          setStrokes(strokesRef.current);
        }
      }
      drawStrokes();
    },
    [drawStrokes, strikeStrokesWithEraser],
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 && strokesRef.current.length === 0) return;
    const prev = undoStack[undoStack.length - 1] ?? [];
    setUndoStack((s) => s.slice(0, -1));
    strokesRef.current = prev;
    setStrokes(prev);
  }, [undoStack]);

  return (
    <div className="flex flex-col gap-2" contentEditable={false}>
      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-1">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-all",
                currentColor === color
                  ? "border-primary scale-110"
                  : "border-transparent hover:scale-105",
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

        <div className="mx-1 h-5 w-px bg-border" />

        <button
          type="button"
          onClick={handleUndo}
          disabled={undoStack.length === 0 && strokes.length === 0}
          className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsErasing((v) => !v)}
          className={cn(
            "h-7 w-7 rounded-md inline-flex items-center justify-center transition-colors hover:bg-muted hover:text-foreground",
            isErasing
              ? "bg-destructive/10 text-destructive"
              : "text-muted-foreground",
          )}
          title="Eraser"
        >
          <Eraser className="h-4 w-4" />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onCancel}
          className="h-7 rounded-md px-2 text-xs font-medium inline-flex items-center gap-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(strokesRef.current)}
          className="h-7 rounded-md px-2 text-xs font-medium inline-flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/80"
        >
          <Check className="h-3.5 w-3.5" />
          Done
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={cn(
          "w-full border border-border rounded-lg bg-white touch-none select-none",
          isErasing ? "cursor-none" : "cursor-crosshair",
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
