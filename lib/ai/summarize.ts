import { askGroq } from "@/lib/ai/groq";
import { chunkNoteContent, extractHeadings, type Heading } from "@/lib/ai/chunk";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai:summarize");

const MAX_SUMMARY_INPUT_CHARS = 12000;

export function formatOutline(headings: Heading[]): string | null {
  if (headings.length === 0) return null;
  return headings
    .map((h) => {
      const depth = Math.max(0, Math.min(h.level - 1, 5));
      return `${"  ".repeat(depth)}- ${h.text}`;
    })
    .join("\n");
}

export async function summarizeNote(
  title: string,
  headings: Heading[],
  text: string
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const outline = headings.map((h) => h.text).join("\n");
  const capped =
    trimmed.length > MAX_SUMMARY_INPUT_CHARS
      ? `${trimmed.slice(0, MAX_SUMMARY_INPUT_CHARS)}\n\n[...truncated...]`
      : trimmed;

  const system =
    "You write short overviews of a user's note. Reply with 2-4 plain sentences " +
    "describing what the note is about and its main points. Do not use markdown " +
    "headings or bullet lists, and do not preface with phrases like 'This note'.";

  const sections = outline ? `\n\nSections:\n${outline}` : "";
  const user = `Note title: ${title}${sections}\n\nNote content:\n${capped}`;

  const summary = await askGroq([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  return summary.trim();
}

/**
 * Build a note summary + heading outline from raw note content.
 * Summary generation uses the headings to stay on-structure.
 */
export async function buildNoteSummary(
  title: string,
  rawContent: string
): Promise<{ summary: string | null; outline: string | null }> {
  const chunks = chunkNoteContent(rawContent);
  if (chunks.length === 0) return { summary: null, outline: null };

  const headings = extractHeadings(rawContent);
  const outline = formatOutline(headings);
  const summary = await summarizeNote(title, headings, chunks.join("\n\n"));

  log.info(`Built note summary`, {
    headings: headings.length,
    summaryLength: summary.length,
  });

  return { summary: summary || null, outline };
}
