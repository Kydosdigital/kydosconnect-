# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

Kydos Connect turns a business website into an MCP server that AI assistants (Claude, ChatGPT, Cursor) can connect to. Sold by Kydos Digital in three tiers:

| Tier | Promise | Tools |
| --- | --- | --- |
| Starter | AI can **read** your website | `search_site`, `get_page`, `list_pages`, `get_business_info` |
| Growth | AI can **see how your website is doing** | + `get_traffic_summary`, `get_top_pages`, `get_realtime_visitors`, `list_enquiries` (GA4, forms) |
| Pro | AI can **manage your website** | + `draft_page_update`, `create_blog_draft`, `publish_change`, `run_health_check` (WordPress first) |

Current phase: **Phase 1 (Read)**. Do not build Growth or Pro tools unless asked.

## Stack

- Next.js 16 App Router, TypeScript (strict), deployed on Vercel
- Supabase: Postgres + pgvector, Auth, Vault (for client credentials later)
- MCP: `@modelcontextprotocol/sdk` 1.x, `WebStandardStreamableHTTPServerTransport`, **stateless** (new server per request)
- Embeddings: OpenAI `text-embedding-3-small`, 1536 dimensions
- Crawling: built-in fetch + cheerio crawler; Firecrawl if `FIRECRAWL_API_KEY` is set
- Zod v4 for tool input schemas

## Layout

```
src/app/api/mcp/[tenant]/route.ts   MCP endpoint, one URL per tenant slug
src/app/api/crawl/route.ts          Admin: re-crawl a site (ADMIN_SECRET bearer)
src/mcp/server.ts                   Tool definitions, plan gating, call logging
src/lib/auth.ts                     MCP key generation, hashing, tenant lookup
src/lib/crawl.ts                    Site discovery (sitemap, links, robots.txt) and HTML to markdown
src/lib/chunk.ts                    Heading-aware chunking
src/lib/ingest.ts                   Crawl, diff by content hash, embed, store
src/lib/db.ts                       Service-role Supabase client
supabase/migrations/                SQL migrations (source of truth for the schema)
scripts/                            CLI: create-tenant, crawl
```

## Rules that must not be broken

1. **Tenant isolation.** The service-role client bypasses RLS. Every query in server code must filter by `tenant_id` from the authenticated `TenantContext`, never from user input or tool arguments.
2. **Keys are hashed.** Store only `sha256(key)`. Raw keys are shown once and never logged.
3. **Every tool goes through `logged()`** so calls land in `tool_calls` (analytics, billing, audit).
4. **Plan gating** happens in `buildServer`: register a tool only if `allows(tenant, plan)`.
5. **Write tools never publish directly.** They create a draft plus a `change_requests` row; publishing needs approval. (Phase 3.)
6. **Read-only tools** set `annotations: { readOnlyHint: true }`.
7. **Schema changes** go in a new timestamped file in `supabase/migrations/`; never edit an applied migration.
8. British English in all user-facing text. No em dashes.

## Commands

```bash
npm run dev            # local server on :3000
npm run typecheck      # tsc --noEmit
npm run build          # production build
npm run tenant:create -- --slug my-client --name "My Client" --url https://example.com
npm run crawl -- --slug my-client
```

Scripts read `.env.local` (copy `.env.example`).

## Testing an MCP change

1. `npm run dev`
2. `npx @modelcontextprotocol/inspector`, transport "Streamable HTTP", URL `http://localhost:3000/api/mcp/<slug>`, header `Authorization: Bearer <key>`
3. Or add the deployed URL as a custom connector in Claude: `https://<host>/api/mcp/<slug>?key=<key>`

## Dashboard

- Sign-in: Supabase magic link (`/login` → `/auth/callback`). `src/proxy.ts` (Next 16's replacement for middleware) refreshes sessions and guards `/dashboard`.
- Every dashboard page and server action calls `requireMembership(slug)` before touching data.
- `BusinessView` is presentational (no data fetching); `dashboard/[slug]/page.tsx` loads data and passes it in.
- Design tokens live in `src/app/globals.css`. System font stack only (Stephen prefers standard fonts, no web fonts); system monospace only inside copy fields for keys and URLs. Signal green means "live"; cobalt is for actions. The connection "wire" is the one bold element: keep everything else quiet.

## Next up (Sprint 1 remainder)

- Weekly re-crawl via Vercel Cron
- Agency view: Kydos staff see all client businesses
- 10 test questions per pilot site, record accuracy

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
