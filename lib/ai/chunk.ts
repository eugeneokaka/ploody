import { extractPlainText } from "@/lib/render-content";

const CHUNK_MAX_CHARS = 2000;
const OVERLAP_CHARS = 200;

export function noteToText(content: string): string {
  return extractPlainText(content).replace(/\s+/g, " ").trim();
}

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= CHUNK_MAX_CHARS) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_MAX_CHARS, normalized.length);

    if (end < normalized.length) {
      const space = normalized.lastIndexOf(" ", end);
      if (space > start + CHUNK_MAX_CHARS * 0.5) {
        end = space;
      }
    }

    chunks.push(normalized.slice(start, end).trim());

    if (end >= normalized.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }

  return chunks.filter(Boolean);
}
