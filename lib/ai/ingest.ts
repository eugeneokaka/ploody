import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { embedTexts } from "@/lib/ai/cohere";
import { noteToText, chunkText } from "@/lib/ai/chunk";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai:ingest");

export async function ingestNote(
  noteId: string,
  userId: string
): Promise<number> {
  const note = await prisma.note.findUnique({
    where: { id: noteId, userId },
    select: {
      id: true,
      currentVersion: { select: { content: true } },
    },
  });

  if (!note) {
    log.error(`Note not found`, { noteId });
    throw new Error("Note not found");
  }

  const text = noteToText(note.currentVersion?.content ?? "");
  const chunks = chunkText(text);

  log.info(`Note loaded`, {
    noteId,
    textLength: text.length,
    chunks: chunks.length,
  });

  let vectors: number[][] = [];
  if (chunks.length > 0) {
    log.info(`Generating embeddings for ${chunks.length} chunks`);
    vectors = await embedTexts(chunks, "search_document");
    log.info(`Embeddings generated (${vectors.length})`);
  } else {
    log.warn(`No text found to index`, { noteId });
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.$executeRaw`DELETE FROM "note_chunk" WHERE "noteId" = ${noteId}`;
    log.info(`Deleted old chunks`, { noteId, deleted });

    for (let i = 0; i < chunks.length; i++) {
      const embedding = `[${vectors[i].join(",")}]`;
      await tx.$executeRaw`
        INSERT INTO "note_chunk" ("id", "noteId", "chunkIndex", "content", "embedding", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${noteId}, ${i}, ${chunks[i]}, CAST(${embedding} AS vector), NOW(), NOW())
      `;
    }
  });

  log.info(`Ingestion complete`, { noteId, chunks: chunks.length });
  return chunks.length;
}

export async function deleteChunks(noteId: string): Promise<void> {
  const deleted = await prisma.$executeRaw`DELETE FROM "note_chunk" WHERE "noteId" = ${noteId}`;
  log.info(`Deleted chunks`, { noteId, deleted });
}
