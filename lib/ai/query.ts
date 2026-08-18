import prisma from "@/lib/prisma";
import { embedQuery } from "@/lib/ai/cohere";
import { askGroq, type ChatMessage } from "@/lib/ai/groq";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai:query");

const SIMILARITY_THRESHOLD = 0.2;

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
      currentVersion: { select: { title: true } },
    },
  });

  if (!note) {
    log.error(`Note not found`, { noteId });
    throw new Error("Note not found");
  }

  log.info(`Querying note`, { noteId, question, history: history.length });

  const vector = await embedQuery(question);
  const vectorStr = `[${vector.join(",")}]`;

  const sources = await prisma.$queryRaw<RetrievedChunk[]>`
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

  const title = note.currentVersion?.title ?? "Untitled";
  const related = sources.some(
    (s) => Number(s.similarity) >= SIMILARITY_THRESHOLD
  );

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
          "You are a helpful assistant. The user's message includes relevant excerpts from their note. " +
          `Use those excerpts as your primary source for the note titled "${title}", but answer naturally and helpfully.`,
      },
      ...history,
      {
        role: "user",
        content: `Note excerpts:\n${context}\n\nQuestion: ${question}`,
      },
    ];
    log.info(`Question related to note, using ${usedSources.length} chunk(s)`);
  } else {
    usedSources = [];
    messages = [
      { role: "system", content: "You are a helpful assistant." },
      ...history,
      { role: "user", content: question },
    ];
    log.info(`Question not related to note, answering as general assistant`);
  }

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
