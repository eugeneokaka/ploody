import { CohereClientV2 } from "cohere-ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("ai:cohere");

const EMBED_MODEL = "embed-v4.0";
const OUTPUT_DIMENSION = 1024;
const BATCH_SIZE = 96;

let client: CohereClientV2 | null = null;

function getClient(): CohereClientV2 {
  if (!client) {
    const token = process.env.COHERE_API_KEY;
    if (!token) {
      log.error("COHERE_API_KEY is not set");
      throw new Error("COHERE_API_KEY is not set");
    }
    client = new CohereClientV2({ token });
    log.info("Cohere client initialized");
  }
  return client;
}

export type EmbedInputType = "search_document" | "search_query";

export async function embedTexts(
  texts: string[],
  inputType: EmbedInputType
): Promise<number[][]> {
  const c = getClient();
  const vectors: number[][] = [];

  log.info(`Embedding ${texts.length} text(s)`, {
    model: EMBED_MODEL,
    inputType,
    outputDimension: OUTPUT_DIMENSION,
  });

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    log.info(`Embedding batch ${i / BATCH_SIZE + 1} (${batch.length} texts)`);

    const res = await c.embed({
      texts: batch,
      model: EMBED_MODEL,
      inputType,
      embeddingTypes: ["float"],
      outputDimension: OUTPUT_DIMENSION,
    });

    const floats = res.embeddings.float;
    if (!floats || floats.length !== batch.length) {
      log.error("Cohere embed returned no/mismatched float embeddings", {
        expected: batch.length,
        received: floats?.length ?? 0,
      });
      throw new Error("Cohere embed returned no float embeddings");
    }
    vectors.push(...floats);
  }

  log.info(`Embedding complete (${vectors.length} vectors)`);
  return vectors;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text], "search_query");
  return vector;
}
