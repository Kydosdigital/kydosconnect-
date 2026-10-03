// Kydos Connect: text embeddings with Supabase's built-in gte-small model (384 dimensions).
// No external API key needed. Only callable with the service role key.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const session = new Supabase.ai.Session("gte-small");
const MAX_INPUTS = 16;
const MAX_CHARS = 4000;

function isServiceRole(req: Request): boolean {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // The gateway has already verified the JWT signature (verify_jwt); here we require the service role.
  if (!isServiceRole(req)) return Response.json({ error: "Forbidden" }, { status: 403 });

  let inputs: unknown;
  try {
    ({ inputs } = await req.json());
  } catch {
    return Response.json({ error: "Body must be JSON: { inputs: string[] }" }, { status: 400 });
  }
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > MAX_INPUTS || inputs.some((i) => typeof i !== "string")) {
    return Response.json({ error: `inputs must be 1 to ${MAX_INPUTS} strings` }, { status: 400 });
  }

  const embeddings: number[][] = [];
  for (const text of inputs as string[]) {
    const vector = (await session.run(text.slice(0, MAX_CHARS), { mean_pool: true, normalize: true })) as number[];
    embeddings.push(Array.from(vector));
  }
  return Response.json({ embeddings });
});
