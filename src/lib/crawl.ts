import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { optionalEnv } from "./env";

export interface CrawledPage {
  url: string;
  title: string | null;
  description: string | null;
  markdown: string;
}

const USER_AGENT = "KydosConnectBot/0.1 (+https://kydosdigital.co.uk)";
const SKIP_EXTENSIONS = /\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|json|xml|zip|mp4|mp3|woff2?|ttf)$/i;
const SKIP_PATHS = /\/(wp-admin|wp-login|cart|checkout|my-account|login|basket|feed)(\/|$)/i;

/** Normalise a URL so the same page is never crawled twice. */
export function normaliseUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(p)) u.searchParams.delete(p);
    }
    if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<{ status: number; type: string; body: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml;q=0.9,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    return { status: res.status, type: res.headers.get("content-type") ?? "", body: await res.text() };
  } catch {
    return null;
  }
}

/** Very small robots.txt reader: honours Disallow rules for all user agents. */
async function loadDisallowRules(origin: string): Promise<string[]> {
  const res = await fetchText(`${origin}/robots.txt`);
  if (!res || res.status !== 200) return [];
  const rules: string[] = [];
  let applies = false;
  for (const raw of res.body.split("\n")) {
    const line = raw.split("#")[0].trim();
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) applies = value === "*" || /kydosconnect/i.test(value);
    else if (applies && /^disallow$/i.test(key) && value) rules.push(value);
  }
  return rules;
}

async function sitemapUrls(origin: string, limit: number): Promise<string[]> {
  const found = new Set<string>();
  const queue = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`];
  const seen = new Set<string>();
  while (queue.length && found.size < limit && seen.size < 20) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    const res = await fetchText(sm);
    if (!res || res.status !== 200) continue;
    const $ = cheerio.load(res.body, { xml: true });
    $("sitemap > loc").each((_, el) => {
      queue.push($(el).text().trim());
    });
    $("url > loc").each((_, el) => {
      const u = normaliseUrl($(el).text().trim());
      if (u) found.add(u);
    });
  }
  return [...found];
}

/** Convert the meaningful part of an HTML page into compact markdown. */
export function htmlToPage(html: string, url: string): CrawledPage & { links: string[] } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || null;
  const description = $('meta[name="description"]').attr("content")?.trim() || null;

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const u = normaliseUrl($(el).attr("href")!, url);
    if (u) links.push(u);
  });

  $(
    "script, style, noscript, iframe, svg, form, nav, header, [role=navigation], [role=banner], [aria-hidden=true], .cookie, #cookie-notice",
  ).remove();
  const root = $("main").first().length ? $("main").first() : $("body");

  const lines: string[] = [];
  // Join text from separate elements with spaces, so "<a>Work</a><a>Services</a>" reads "Work Services"
  const BLOCKISH = /^(a|li|p|div|span|td|th|br|h[1-6]|button|label|strong|em|b|i)$/;
  const text = (el: AnyNode): string => {
    const parts: string[] = [];
    const visit = (n: AnyNode) => {
      if (n.type === "text") parts.push((n as unknown as { data: string }).data);
      else if (n.type === "tag") {
        const e = n as Element;
        if (BLOCKISH.test(e.tagName.toLowerCase())) parts.push(" ");
        for (const c of e.children) visit(c);
        if (BLOCKISH.test(e.tagName.toLowerCase())) parts.push(" ");
      }
    };
    visit(el);
    return parts.join("").replace(/\s+/g, " ").replace(/\s+([.,;:!?)])/g, "$1").trim();
  };

  const walk = (node: AnyNode) => {
    if (node.type !== "tag") return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const t = text(el);
      if (t) lines.push("", `${"#".repeat(Math.min(Number(tag[1]), 3))} ${t}`, "");
      return;
    }
    if (tag === "p" || tag === "blockquote" || tag === "address") {
      const t = text(el);
      if (t) lines.push(t, "");
      return;
    }
    if (tag === "li") {
      const t = text(el);
      if (t) lines.push(`- ${t}`);
      return;
    }
    if (tag === "tr") {
      const cells = $(el).children("th,td").map((_, c) => text(c)).get().filter(Boolean);
      if (cells.length) lines.push(`| ${cells.join(" | ")} |`);
      return;
    }
    // Leaf containers with direct text (common in page builders like Elementor)
    const hasBlockChildren = $(el).children("p,h1,h2,h3,h4,h5,h6,ul,ol,table,div,section,article,li").length > 0;
    if (!hasBlockChildren && ["div", "span", "td", "section", "article"].includes(tag)) {
      const t = text(el);
      if (t) lines.push(t, "");
      return;
    }
    for (const child of el.children) walk(child);
    if (tag === "ul" || tag === "ol" || tag === "table") lines.push("");
  };
  for (const child of root.get(0)?.children ?? []) walk(child);

  const markdown = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { url, title, description, markdown, links };
}

async function firecrawlScrape(url: string, apiKey: string): Promise<CrawledPage | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { markdown?: string; metadata?: { title?: string; description?: string } };
    };
    if (!json.data?.markdown) return null;
    return {
      url,
      title: json.data.metadata?.title ?? null,
      description: json.data.metadata?.description ?? null,
      markdown: json.data.markdown,
    };
  } catch {
    return null;
  }
}

export interface CrawlOptions {
  maxPages?: number;
  onPage?: (page: CrawledPage) => void;
}

/**
 * Crawl a website: start from the sitemap if there is one, otherwise follow
 * same-origin links breadth-first from the home page.
 */
export async function crawlSite(startUrl: string, opts: CrawlOptions = {}): Promise<CrawledPage[]> {
  const maxPages = opts.maxPages ?? 100;
  const start = normaliseUrl(startUrl);
  if (!start) throw new Error(`Invalid URL: ${startUrl}`);
  const origin = new URL(start).origin;
  const disallow = await loadDisallowRules(origin);
  const firecrawlKey = optionalEnv("FIRECRAWL_API_KEY");

  const allowed = (u: string) => {
    const parsed = new URL(u);
    if (parsed.origin !== origin) return false;
    if (SKIP_EXTENSIONS.test(parsed.pathname) || SKIP_PATHS.test(parsed.pathname)) return false;
    return !disallow.some((rule) => parsed.pathname.startsWith(rule));
  };

  const queue: string[] = [start, ...(await sitemapUrls(origin, maxPages * 2)).filter(allowed)];
  const seen = new Set<string>();
  const pages: CrawledPage[] = [];
  const seenHashes = new Set<string>();
  const CONCURRENCY = 5;

  const fetchPage = async (url: string): Promise<{ page: CrawledPage | null; links: string[] }> => {
    if (firecrawlKey) {
      const page = await firecrawlScrape(url, firecrawlKey);
      if (page) return { page, links: [] };
    }
    const res = await fetchText(url);
    if (!res || res.status >= 400 || !res.type.includes("text/html")) return { page: null, links: [] };
    const parsed = htmlToPage(res.body, url);
    return {
      page: { url: parsed.url, title: parsed.title, description: parsed.description, markdown: parsed.markdown },
      links: parsed.links,
    };
  };

  // Fetch a few pages at a time: fast enough for a weekly crawl, gentle on small business hosting
  while (queue.length && pages.length < maxPages) {
    const batch: string[] = [];
    while (queue.length && batch.length < CONCURRENCY) {
      const url = queue.shift()!;
      if (seen.has(url) || !allowed(url)) continue;
      seen.add(url);
      batch.push(url);
    }
    if (!batch.length) break;

    const results = await Promise.all(batch.map(fetchPage));
    for (const { page, links } of results) {
      for (const link of links) if (!seen.has(link) && allowed(link)) queue.push(link);
      // Skip near-empty pages and exact duplicates (e.g. tag archives)
      if (!page || page.markdown.length < 80 || seenHashes.has(page.markdown)) continue;
      if (pages.length >= maxPages) break;
      seenHashes.add(page.markdown);
      pages.push(page);
      opts.onPage?.(page);
    }
  }
  return pages;
}
