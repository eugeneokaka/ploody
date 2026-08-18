import { createLogger } from "@/lib/logger";

const log = createLogger("ai:groq");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function askGroq(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    log.error("GROQ_API_KEY is not set");
    throw new Error("GROQ_API_KEY is not set");
  }

  log.info(`Calling Groq`, { model: MODEL, messages: messages.length });

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    log.error(`Groq request failed`, { status: res.status, body: text });
    throw new Error(`Groq request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content ?? "";

  if (!answer) {
    log.warn("Groq returned an empty answer");
  } else {
    log.info(`Groq answered (${answer.length} chars)`);
  }

  return answer;
}
