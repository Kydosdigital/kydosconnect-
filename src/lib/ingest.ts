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

    // Chunk every page first, so blocks repeated across the site (footers, calls to action,
    // menus) can be kept once, on the first page they appear, instead of on every page.
    const chunked = crawled.map((page) => ({ page, chunks: chunkMarkdown(page.markdown, page.title) }));
    const pagesWith = new Map<string, number>();
    const firstPage = new Map<string, string>();
    for (const { page, chunks } of chunked) {
      for (const content of new Set(chunks.map((c) => c.content))) {
        pagesWith.set(content, (pagesWith.get(content) ?? 0) + 1);
        if (!firstPage.has(content)) firstPage.set(content, page.url);
      }
    }
    const REPEATED_ON = 3;

    for (const { page, chunks: all } of chunked) {
      const seenHere = new Set<string>();
      const chunks = all.filter((c) => {
        if (seenHere.has(c.content)) return false;
        seenHere.add(c.content);
        return (pagesWith.get(c.content) ?? 0) < REPEATED_ON || firstPage.get(c.content) === page.url;
      });

      // The hash covers what is actually indexed, so a change in kept passages triggers a rewrite
      const hash = sha256(`${page.title ?? ""}\n${chunks.map((c) => c.content).join("\n")}`);
      const prior = existingByUrl.get(page.url);
      existingByUrl.delete(page.url);
      if (prior && prior.content_hash === hash) continue;

      // Saved with an empty hash until its passages are stored: if anything fails part-way,
      // the next crawl redoes this page instead of skipping it as unchanged
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
            content_hash: "",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "site_id,url" },
        )
        .select("id")
        .single();
      if (upsertError || !saved) throw new Error(`Failed to save ${page.url}: ${upsertError?.message}`);

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
      await supabase.from("pages").update({ content_hash: hash }).eq("id", saved.id);
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
