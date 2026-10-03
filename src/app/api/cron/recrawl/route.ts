import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { isAdmin } from "@/lib/auth";
import { ingestSite } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WEEK_MS = 7 * 86_400_000;
const STUCK_MS = 30 * 60_000;
const SITES_PER_RUN = 4;
const TIME_BUDGET_MS = 240_000;

/**
 * GET /api/cron/recrawl: called nightly by Vercel Cron (Authorization: Bearer CRON_SECRET).
 * Re-reads sites not read for a week, plus any that failed, oldest first, a few per night.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAdmin(req, env("CRON_SECRET"))) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const supabase = db();
  const started = Date.now();

  // A crawl killed mid-way (timeout, deploy) is left as "crawling": release it
  await supabase
    .from("sites")
    .update({ crawl_status: "failed", last_error: "The last read did not finish; it will be retried" })
    .eq("crawl_status", "crawling")
    .lt("crawl_started_at", new Date(Date.now() - STUCK_MS).toISOString());

  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();
  const { data: due, error } = await supabase
    .from("sites")
    .select("id, url, crawl_status, last_crawled_at")
    .neq("crawl_status", "crawling")
    .or(`last_crawled_at.is.null,last_crawled_at.lt.${weekAgo},crawl_status.eq.failed`)
    .order("last_crawled_at", { ascending: true, nullsFirst: true })
    .limit(SITES_PER_RUN);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: { url: string; ok: boolean; detail: unknown }[] = [];
  for (const site of due ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      results.push({ url: site.url, ok: true, detail: await ingestSite(site.id) });
    } catch (err) {
      results.push({ url: site.url, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return Response.json({ checked: due?.length ?? 0, results });
}
