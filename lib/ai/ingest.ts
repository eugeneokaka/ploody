import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { embedTexts } from "@/lib/ai/cohere";
import { chunkNoteContent } from "@/lib/ai/chunk";
import { buildNoteSummary } from "@/lib/ai/summarize";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai:ingest");

const INSERT_BATCH_SIZE = 100;

export async function ingestNote(
  noteId: string,
  userId: string
): Promise<number> {
  const note = await prisma.note.findUnique({
    where: { id: noteId, userId },
    select: {
      id: true,
      currentVersion: { select: { id: true, title: true, content: true } },
    },
  });

  if (!note) {
    log.error(`Note not found`, { noteId });
    throw new Error("Note not found");
  }

  const rawContent = note.currentVersion?.content ?? "";
  const chunks = chunkNoteContent(rawContent);

  log.info(`Note loaded`, {
    noteId,
    rawLength: rawContent.length,
    rawIsJson: rawContent.trim().startsWith("{"),
    rawPreview: rawContent.slice(0, 300),
    chunks: chunks.length,
  });

  log.info(`Chunks to embed`, {
    chunks: chunks.map((c, i) => ({ index: i, length: c.length, content: c })),
  });

  let vectors: number[][] = [];
  if (chunks.length > 0) {
    log.info(`Generating embeddings for ${chunks.length} chunks`);
    vectors = await embedTexts(chunks, "search_document");
    log.info(`Embeddings generated (${vectors.length})`);
  } else {
    log.warn(`No text found to index`, { noteId });
  }

  const embeddingStrings = vectors.map((v) => `[${v.join(",")}]`);

  let summary: string | null = null;
  let outline: string | null = null;
  if (note.currentVersion) {
    const built = await buildNoteSummary(note.currentVersion.title, rawContent);
    summary = built.summary;
    outline = built.outline;
  }

  await prisma.$transaction(
    async (tx) => {
      const deleted = await tx.$executeRaw`DELETE FROM "note_chunk" WHERE "noteId" = ${noteId}`;
      log.info(`Deleted old chunks`, { noteId, deleted });

      for (let start = 0; start < chunks.length; start += INSERT_BATCH_SIZE) {
        const batch = chunks.slice(start, start + INSERT_BATCH_SIZE);
        const rows = Prisma.join(
          batch.map((chunk, j) => {
            const i = start + j;
            return Prisma.sql`(${randomUUID()}, ${noteId}, ${i}, ${chunk}, CAST(${embeddingStrings[i]} AS vector), NOW(), NOW())`;
          })
        );

        await tx.$executeRaw`
          INSERT INTO "note_chunk" ("id", "noteId", "chunkIndex", "content", "embedding", "createdAt", "updatedAt")
          VALUES ${rows}
        `;
      }

      if (note.currentVersion) {
        await tx.noteVersion.update({
          where: { id: note.currentVersion.id },
          data: { summary, outline },
        });
      }
    },
    { maxWait: 10000, timeout: 60000 }
  );

  log.info(`Ingestion complete`, { noteId, chunks: chunks.length });
  return chunks.length;
}

export async function deleteChunks(noteId: string): Promise<void> {
  const deleted = await prisma.$executeRaw`DELETE FROM "note_chunk" WHERE "noteId" = ${noteId}`;
  log.info(`Deleted chunks`, { noteId, deleted });
}
