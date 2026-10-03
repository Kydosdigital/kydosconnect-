import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { TenantContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { embedOne, toPgVector } from "@/lib/embeddings";

type Plan = TenantContext["plan"];
const PLAN_RANK: Record<Plan, number> = { starter: 0, growth: 1, pro: 2 };
const allows = (tenant: TenantContext, minimum: Plan) => PLAN_RANK[tenant.plan] >= PLAN_RANK[minimum];

const MAX_PAGE_CHARS = 20_000;

interface RequestMeta {
  clientName: string | null;
}

const text = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }], isError: true });

/**
 * Wrap a tool handler so every call is timed and written to tool_calls.
 * Logging failures never break the tool response.
 */
function logged<A>(
  tenant: TenantContext,
  meta: RequestMeta,
  tool: string,
  handler: (args: A) => Promise<CallToolResult>,
) {
  return async (args: A): Promise<CallToolResult> => {
    const started = Date.now();
    let result: CallToolResult;
    let error: string | null = null;
    try {
      result = await handler(args);
      if (result.isError) error = String(result.content?.[0] && "text" in result.content[0] ? result.content[0].text : "error");
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error(`[mcp] ${tenant.slug} ${tool} failed:`, err);
      result = fail("Something went wrong running this tool. Please try again shortly.");
    }
    try {
      await db().from("tool_calls").insert({
        tenant_id: tenant.tenantId,
        api_key_id: tenant.apiKeyId,
        tool,
        args: (args ?? {}) as Record<string, unknown>,
        client_name: meta.clientName,
        ok: error === null,
        error,
        latency_ms: Date.now() - started,
      });
    } catch (logErr) {
      console.error("[mcp] failed to log tool call", logErr);
    }
    return result;
  };
}

/** Build a fresh MCP server for one tenant. Only tools the tenant's plan allows are registered. */
export function buildServer(tenant: TenantContext, meta: RequestMeta): McpServer {
  const server = new McpServer(
    { name: `kydos-connect-${tenant.slug}`, version: "0.1.0" },
    {
      instructions:
        `You are connected to the website of ${tenant.name}. ` +
        `Use search_site to answer questions about their services, prices, policies and content, ` +
        `and get_business_info for opening hours and contact details. ` +
        `Quote the page URL when you rely on site content. If the site does not cover something, say so rather than guessing.`,
    },
  );

  // ---- Starter: read the website ------------------------------------------------

  server.registerTool(
    "search_site",
    {
      title: "Search the website",
      description: `Semantic search across every page of ${tenant.name}'s website. Returns the most relevant passages with their page URLs.`,
      inputSchema: {
        query: z.string().min(2).max(500).describe("What to look for, in plain language"),
        limit: z.number().int().min(1).max(10).optional().describe("How many passages to return (default 5)"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    logged(tenant, meta, "search_site", async ({ query, limit }: { query: string; limit?: number }) => {
      const vector = await embedOne(query);
      const { data, error } = await db().rpc("match_chunks", {
        p_tenant_id: tenant.tenantId,
        p_query_embedding: toPgVector(vector),
        p_match_count: limit ?? 5,
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { url: string; title: string | null; heading: string | null; content: string; similarity: number }[];
      if (!rows.length) return text("No matching content found on the website.");
      return text(
        rows
          .map(
            (r, i) =>
              `[${i + 1}] ${r.title ?? r.url}${r.heading && r.heading !== r.title ? ` > ${r.heading}` : ""}\n` +
              `URL: ${r.url}\nRelevance: ${r.similarity.toFixed(2)}\n${r.content}`,
          )
          .join("\n\n---\n\n"),
      );
    }),
  );

  server.registerTool(
    "get_page",
    {
      title: "Read a page",
      description: "Return the full text of one page on the website, by URL. Use after search_site when you need the whole page.",
      inputSchema: { url: z.string().url().describe("Full page URL, as returned by search_site or list_pages") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    logged(tenant, meta, "get_page", async ({ url }: { url: string }) => {
      const normalised = url.replace(/\/$/, "");
      const { data } = await db()
        .from("pages")
        .select("url, title, description, markdown, updated_at")
        .eq("tenant_id", tenant.tenantId)
        .in("url", [url, normalised])
        .limit(1)
        .maybeSingle();
      if (!data) return fail(`No page with URL ${url} on this website. Use list_pages to see what is available.`);
      const body = data.markdown.length > MAX_PAGE_CHARS ? `${data.markdown.slice(0, MAX_PAGE_CHARS)}\n\n[truncated]` : data.markdown;
      return text(
        `# ${data.title ?? data.url}\nURL: ${data.url}\nLast updated: ${data.updated_at}\n` +
          (data.description ? `Summary: ${data.description}\n` : "") +
          `\n${body}`,
      );
    }),
  );

  server.registerTool(
    "list_pages",
    {
      title: "List pages",
      description: "List the pages on the website (title and URL), optionally filtered by a word in the title or URL.",
      inputSchema: {
        contains: z.string().max(100).optional().describe("Only pages whose title or URL contains this text"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    logged(tenant, meta, "list_pages", async ({ contains }: { contains?: string }) => {
      let q = db().from("pages").select("url, title").eq("tenant_id", tenant.tenantId).order("url").limit(200);
      if (contains) {
        const safe = contains.replace(/[%,()]/g, " ").trim();
        q = q.or(`title.ilike.%${safe}%,url.ilike.%${safe}%`);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data?.length) return text("No pages found.");
      return text(data.map((p) => `- ${p.title ?? "(untitled)"}: ${p.url}`).join("\n"));
    }),
  );

  server.registerTool(
    "get_business_info",
    {
      title: "Business information",
      description: `Opening hours, locations, contact details, services and policies for ${tenant.name}, as confirmed by the business.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    logged(tenant, meta, "get_business_info", async () => {
      const profile = tenant.profile;
      if (!profile || Object.keys(profile).length === 0) {
        return text(`${tenant.name} has not added a business profile yet. Use search_site for details from the website.`);
      }
      return text(JSON.stringify({ name: tenant.name, ...profile }, null, 2));
    }),
  );

  // ---- Growth and Pro tools are registered here in later phases --------------------
  if (allows(tenant, "growth")) {
    // Phase 2: get_traffic_summary, get_top_pages, get_realtime_visitors, list_enquiries
  }
  if (allows(tenant, "pro")) {
    // Phase 3: draft_page_update, create_blog_draft, publish_change, run_health_check
  }

  return server;
}
