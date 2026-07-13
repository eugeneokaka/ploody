export interface FreehandStroke {
  kind: "stroke";
  color: string;
  width: number;
  points: [number, number][];
}

export interface RectElement {
  kind: "rect";
  color: string;
  width: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircleElement {
  kind: "circle";
  color: string;
  width: number;
  cx: number;
  cy: number;
  r: number;
}

export interface TextElement {
  kind: "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  color: string;
}

export type CanvasElement =
  | FreehandStroke
  | RectElement
  | CircleElement
  | TextElement;

export function normalizeElements(raw: unknown[]): CanvasElement[] {
  return raw.map((el) => {
    const obj = el as Record<string, unknown>;
    if (obj.kind) return obj as unknown as CanvasElement;
    return {
      kind: "stroke" as const,
      color: (obj.color as string) ?? "#1a1a1a",
      width: (obj.width as number) ?? 3,
      points: (obj.points as [number, number][]) ?? [],
    } satisfies FreehandStroke;
  });
}

export function strokeToSvgPath(stroke: FreehandStroke): string {
  if (stroke.points.length < 2) return "";
  const [firstX, firstY] = stroke.points[0];
  let d = `M ${firstX} ${firstY}`;
  for (let i = 1; i < stroke.points.length - 1; i++) {
    const [x1, y1] = stroke.points[i];
    const [x2, y2] = stroke.points[i + 1];
    d += ` Q ${x1} ${y1} ${(x1 + x2) / 2} ${(y1 + y2) / 2}`;
  }
  const last = stroke.points[stroke.points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}
