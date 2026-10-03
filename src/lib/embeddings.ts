import { env } from "./env";

/** Supabase's built-in gte-small model, served by the `embed` Edge Function. */
export const EMBEDDING_MODEL = "gte-small";
export const EMBEDDING_DIMENSIONS = 384;

// Each Edge Function call has a small CPU budget, so send a few texts per call and run calls side by side
const BATCH_SIZE = 4;
const PARALLEL = 4;

async function embedBatch(inputs: string[], attempt = 1): Promise<number[][]> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/functions/v1/embed`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    // Cold starts, brief overloads and compute limits (546) are retried a few times
    if (attempt < 4 && (res.status >= 500 || res.status === 429)) {
      await new Promise((r) => setTimeout(r, 800 * attempt));
      return embedBatch(inputs, attempt + 1);
    }
    throw new Error(`Embedding failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { embeddings: number[][] };
  return json.embeddings;
}

/** Embed many texts, preserving input order. */
export async function embed(texts: string[]): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) batches.push(texts.slice(i, i + BATCH_SIZE));
  const results: number[][][] = new Array(batches.length);
  for (let i = 0; i < batches.length; i += PARALLEL) {
    const group = batches.slice(i, i + PARALLEL);
    const out = await Promise.all(group.map((b) => embedBatch(b)));
    out.forEach((r, j) => (results[i + j] = r));
  }
  return results.flat();
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embed([text]);
  return vector;
}

/** pgvector accepts the JSON-style array literal "[0.1,0.2,...]". */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}
