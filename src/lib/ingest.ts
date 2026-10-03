import { createHash } from "node:crypto";
import { db } from "./db";
import { crawlSite } from "./crawl";
import { chunkMarkdown, embeddingText } from "./chunk";
import { embed, toPgVector } from "./embeddings";

export interface IngestResult {
  siteId: string;
  pagesFound: number;
  pagesChanged: number;
  pagesRemoved: number;
  chunksWritten: number;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Crawl a site and bring its pages and chunks up to date.
 * Unchanged pages (same content hash) are skipped, so weekly re-crawls are cheap.
 */
export async function ingestSite(siteId: string): Promise<IngestResult> {
  const supabase = db();
  const { data: site, error } = await supabase
    .from("sites")
    .select("id, tenant_id, url, max_pages")
    .eq("id", siteId)
    .single();
  if (error || !site) throw new Error(`Site not found: ${siteId}`);

  await supabase
    .from("sites")
    .update({ crawl_status: "crawling", crawl_started_at: new Date().toISOString(), last_error: null })
    .eq("id", site.id);

  try {
    const crawled = await crawlSite(site.url, { maxPages: site.max_pages });

    const { data: existing } = await supabase
      .from("pages")
      .select("id, url, content_hash")
      .eq("site_id", site.id);
    const existingByUrl = new Map((existing ?? []).map((p) => [p.url, p]));

    let pagesChanged = 0;
    let chunksWritten = 0;

    for (const page of crawled) {
      const hash = sha256(page.markdown);
      const prior = existingByUrl.get(page.url);
      existingByUrl.delete(page.url);
      if (prior && prior.content_hash === hash) continue;

      const { data: saved, error: upsertError } = await supabase
        .from("pages")
        .upsert(
          {
            tenant_id: site.tenant_id,
            site_id: site.id,
            url: page.url,
            title: page.title,
            description: page.description,
            markdown: page.markdown,
            content_hash: hash,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "site_id,url" },
        )
        .select("id")
        .single();
      if (upsertError || !saved) throw new Error(`Failed to save ${page.url}: ${upsertError?.message}`);

      const chunks = chunkMarkdown(page.markdown, page.title);
      const vectors = await embed(chunks.map((c) => embeddingText(c, page.title)));

      await supabase.from("chunks").delete().eq("page_id", saved.id);
      if (chunks.length) {
        const { error: chunkError } = await supabase.from("chunks").insert(
          chunks.map((c, i) => ({
            tenant_id: site.tenant_id,
            page_id: saved.id,
            chunk_index: i,
            heading: c.heading,
            content: c.content,
            embedding: toPgVector(vectors[i]),
          })),
        );
        if (chunkError) throw new Error(`Failed to save chunks for ${page.url}: ${chunkError.message}`);
      }
      pagesChanged += 1;
      chunksWritten += chunks.length;
    }

    // Pages that disappeared from the site. Only prune when the crawl actually found pages,
    // so a temporary outage never wipes a tenant's index.
    const removedIds = crawled.length > 0 ? [...existingByUrl.values()].map((p) => p.id) : [];
    if (removedIds.length) await supabase.from("pages").delete().in("id", removedIds);

    await supabase
      .from("sites")
      .update({
        crawl_status: crawled.length > 0 ? "ready" : "failed",
        last_crawled_at: new Date().toISOString(),
        last_error: crawled.length > 0 ? null : "No readable pages found",
      })
      .eq("id", site.id);

    return {
      siteId: site.id,
      pagesFound: crawled.length,
      pagesChanged,
      pagesRemoved: removedIds.length,
      chunksWritten,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("sites").update({ crawl_status: "failed", last_error: message }).eq("id", site.id);
    throw err;
  }
}
