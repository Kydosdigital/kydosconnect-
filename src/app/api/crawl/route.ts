import { env } from "@/lib/env";
import { isAdmin } from "@/lib/auth";
import { ingestSite } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/crawl  { "siteId": "<uuid>" }
 * Internal: re-crawl one site. Protected by ADMIN_SECRET as a bearer token.
 */
export async function POST(req: Request): Promise<Response> {
  if (!isAdmin(req, env("ADMIN_SECRET"))) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { siteId?: string } | null;
  if (!body?.siteId) return Response.json({ error: "siteId is required" }, { status: 400 });
  try {
    const result = await ingestSite(body.siteId);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
