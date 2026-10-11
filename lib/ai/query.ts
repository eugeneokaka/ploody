import prisma from "@/lib/prisma";
import { embedQuery } from "@/lib/ai/cohere";
import { askGroq, type ChatMessage } from "@/lib/ai/groq";
import { buildNoteSummary } from "@/lib/ai/summarize";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai:query");

const SIMILARITY_THRESHOLD = 0.2;

const TRIVIAL_RE =
  /^(hey|hi+|hello|yo|sup|hiya|howdy|greetings|ok(ay)?|thanks|thank you|good (morning|afternoon|evening)|what'?s up|whats up|wassup)[!.?\s]*$/i;

export type RetrievedChunk = {
  id: string;
  content: string;
  chunkIndex: number;
  similarity: number;
};

export type QueryHistory = { role: "user" | "assistant"; content: string };

export async function queryNote(
  noteId: string,
  userId: string,
  question: string,
  history: QueryHistory[] = []
): Promise<{ answer: string; sources: RetrievedChunk[] }> {
  const note = await prisma.note.findUnique({
    where: { id: noteId, userId },
    select: {
      id: true,
      currentVersion: {
        select: {
          id: true,
          title: true,
          content: true,
          summary: true,
          outline: true,
        },
      },
    },
  });

  if (!note) {
    log.error(`Note not found`, { noteId });
    throw new Error("Note not found");
  }

  log.info(`Querying note`, { noteId, question, history: history.length });

  const title = note.currentVersion?.title ?? "Untitled";
  const isTrivial = TRIVIAL_RE.test(question.trim());

  let summary = note.currentVersion?.summary ?? null;
  let outline = note.currentVersion?.outline ?? null;

  // Lazy backfill: older AI-enabled notes have no summary until re-saved.
  if (
    note.currentVersion &&
    summary === null &&
    note.currentVersion.content.trim()
  ) {
    try {
      const built = await buildNoteSummary(title, note.currentVersion.content);
      summary = built.summary;
      outline = built.outline;
      await prisma.noteVersion.update({
        where: { id: note.currentVersion.id },
        data: { summary, outline },
      });
      log.info(`Backfilled note summary`, { noteId });
    } catch (e) {
      log.warn(`Summary backfill failed`, e);
    }
  }

  const overviewParts = [`Note title: "${title}"`];
  if (summary) overviewParts.push(`Summary: ${summary}`);
  if (outline) overviewParts.push(`Sections:\n${outline}`);
  const overview = overviewParts.join("\n");
  const hasOverview = Boolean(summary || outline);

  let sources: RetrievedChunk[] = [];
  if (!isTrivial) {
    const vector = await embedQuery(question);
    const vectorStr = `[${vector.join(",")}]`;

    sources = await prisma.$queryRaw<RetrievedChunk[]>`
      SELECT
        "id",
        "content",
        "chunkIndex" AS "chunkIndex",
        1 - (embedding <=> CAST(${vectorStr} AS vector)) AS similarity
      FROM "note_chunk"
      WHERE "noteId" = ${noteId}
      ORDER BY embedding <=> CAST(${vectorStr} AS vector)
      LIMIT 5
    `;

    log.info(`Vector search returned ${sources.length} source(s)`, {
      similarities: sources.map((s) => Number(s.similarity).toFixed(4)),
    });

    log.info(`Retrieved chunks (full content)`, {
      sources: sources.map((s) => ({
        chunkIndex: s.chunkIndex,
        similarity: Number(s.similarity).toFixed(4),
        length: s.content.length,
        content: s.content,
      })),
    });
  }

  const related =
    !isTrivial &&
    sources.some((s) => Number(s.similarity) >= SIMILARITY_THRESHOLD);

  let messages: ChatMessage[];
  let usedSources: RetrievedChunk[];

  if (related) {
    const context = sources
      .map((s, i) => `[${i + 1}] ${s.content}`)
      .join("\n\n");

    usedSources = sources;
    messages = [
      {
        role: "system",
        content:
          `You are a helpful assistant for the note titled "${title}".\n` +
          `${overview}\n\n` +
          "The user's message includes relevant excerpts from this note. Use those excerpts " +
          "as your primary source, and use the note overview above for general context. " +
          "Answer naturally and helpfully.",
      },
      ...history,
      {
        role: "user",
        content: `Note excerpts:\n${context}\n\nQuestion: ${question}`,
      },
    ];
    log.info(`Question related to note, using ${usedSources.length} chunk(s)`);
  } else if (!isTrivial && hasOverview) {
    usedSources = [];
    messages = [
      {
        role: "system",
        content:
          `You are a helpful assistant for the note titled "${title}".\n` +
          `${overview}\n\n` +
          "Answer the user's question about this note using the overview above. " +
          "If the overview does not cover it, say you don't have enough detail in this note.",
      },
      ...history,
      { role: "user", content: question },
    ];
    log.info(`Question using note overview only`);
  } else {
    usedSources = [];
    messages = [
      { role: "system", content: "You are a helpful assistant." },
      ...history,
      { role: "user", content: question },
    ];
    log.info(`Question not related to note, answering as general assistant`);
  }

  log.info(`Prompt fed to LLM`, {
    related,
    usedSources: usedSources.length,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const answer = await askGroq(messages);

  log.info(`Answer generated`, { noteId, answerLength: answer.length });

  return {
    answer,
    sources: usedSources.map((s) => ({
      ...s,
      content: s.content.slice(0, 300),
    })),
  };
}
