export interface Stroke {
  color: string;
  width: number;
  points: [number, number][];
}

export function strokeToSvgPath(stroke: Stroke): string {
  if (stroke.points.length < 2) return "";

  const [firstX, firstY] = stroke.points[0];
  let d = `M ${firstX} ${firstY}`;

  for (let i = 1; i < stroke.points.length - 1; i++) {
    const [x1, y1] = stroke.points[i];
    const [x2, y2] = stroke.points[i + 1];
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    d += ` Q ${x1} ${y1} ${midX} ${midY}`;
  }

  const last = stroke.points[stroke.points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;

  return d;
}
