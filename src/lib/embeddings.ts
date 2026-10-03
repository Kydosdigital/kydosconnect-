import OpenAI from "openai";
import { env } from "./env";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

let openai: OpenAI | null = null;
function client(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: env("OPENAI_API_KEY") });
  return openai;
}

/** Embed a batch of texts, preserving input order. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  const batchSize = 96;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await client().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    for (const item of res.data.sort((a, b) => a.index - b.index)) {
      out.push(item.embedding);
    }
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embed([text]);
  return vector;
}

/** pgvector accepts the JSON-style array literal "[0.1,0.2,...]". */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
