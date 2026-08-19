const CHUNK_MAX_CHARS = 400;
const CHUNK_MIN_CHARS = 40;

type Block = { kind: "heading" | "text"; text: string };
type JsonNode = Record<string, unknown>;

const BLOCK_TEXT_TYPES = new Set([
  "paragraph",
  "listItem",
  "blockquote",
  "codeBlock",
]);

function inlineText(node: JsonNode): string {
  if (!node) return "";
  if (node.type === "text") return (node.text as string) || "";
  if (Array.isArray(node.content)) {
    return (node.content as JsonNode[]).map((c) => inlineText(c)).join(" ");
  }
  return "";
}

function extractBlocks(node: JsonNode, out: Block[]): void {
  if (!node || typeof node !== "object") return;
  const type = node.type as string | undefined;

  if (type === "heading") {
    const text = inlineText(node).replace(/\s+/g, " ").trim();
    if (text) out.push({ kind: "heading", text });
    return;
  }

  if (type && BLOCK_TEXT_TYPES.has(type)) {
    const text = inlineText(node).replace(/\s+/g, " ").trim();
    if (text) out.push({ kind: "text", text });
    return;
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content as JsonNode[]) {
      extractBlocks(child, out);
    }
  }
}

function joinHeadingBody(heading: string, body: string): string {
  if (!body) return heading;
  return /[.!?]$/.test(heading) ? `${heading} ${body}` : `${heading}. ${body}`;
}

function splitByWords(text: string, max: number): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (current && next.length > max) {
      chunks.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function splitBySentences(text: string, max: number): string[] {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];

  // Split into complete sentences (period/question/exclamation + space or end).
  const sentences = trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
  if (!sentences || sentences.length === 0) {
    return splitByWords(trimmed, max);
  }

  const chunks: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    const next = current ? `${current} ${s}` : s;
    if (current && next.length > max) {
      chunks.push(current);
      current = s;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  return chunks.length > 0 ? chunks : [trimmed];
}

/**
 * Split note content into chunks for embedding:
 * - sections start at heading boundaries
 * - a section longer than CHUNK_MAX_CHARS is split on sentence boundaries
 * - a section shorter than CHUNK_MIN_CHARS is merged into the previous chunk
 *   so we don't lose tiny fragments of meaning
 */
export function chunkNoteContent(content: string): string[] {
  let doc: JsonNode;
  try {
    doc = JSON.parse(content);
  } catch {
    const fallback = content.replace(/\s+/g, " ").trim();
    return fallback ? splitBySentences(fallback, CHUNK_MAX_CHARS) : [];
  }

  const blocks: Block[] = [];
  extractBlocks(doc, blocks);
  if (blocks.length === 0) return [];

  // Group blocks into sections by heading.
  const sections: { heading: string | null; body: string[] }[] = [];
  let current: { heading: string | null; body: string[] } | null = null;
  for (const b of blocks) {
    if (b.kind === "heading") {
      current = { heading: b.text, body: [] };
      sections.push(current);
    } else {
      if (!current) {
        current = { heading: null, body: [] };
        sections.push(current);
      }
      current.body.push(b.text);
    }
  }

  const candidates: string[] = [];
  for (const sec of sections) {
    const body = sec.body.join(" ").replace(/\s+/g, " ").trim();
    const full = sec.heading ? joinHeadingBody(sec.heading, body) : body;
    if (!full) continue;

    if (full.length > CHUNK_MAX_CHARS) {
      candidates.push(...splitBySentences(full, CHUNK_MAX_CHARS));
    } else {
      candidates.push(full);
    }
  }

  // Merge too-short candidates into a neighboring chunk to avoid fragments.
  const chunks: string[] = [];
  let pending = "";
  for (const c of candidates) {
    const clean = c.replace(/\s+/g, " ").trim();
    if (!clean) continue;

    if (clean.length < CHUNK_MIN_CHARS) {
      if (
        chunks.length > 0 &&
        (chunks[chunks.length - 1] + " " + clean).length <= CHUNK_MAX_CHARS
      ) {
        chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${clean}`.trim();
      } else {
        pending = pending ? `${pending} ${clean}` : clean;
      }
      continue;
    }

    if (pending) {
      chunks.push(`${pending} ${clean}`.trim());
      pending = "";
    } else {
      chunks.push(clean);
    }
  }

  if (pending) {
    if (chunks.length > 0) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${pending}`.trim();
    } else {
      chunks.push(pending);
    }
  }

  return chunks;
}
