# Kydos Connect

**Your website, working inside every AI assistant.** Read it, measure it, manage it. Just ask.

Kydos Connect crawls a business website, indexes it, and serves it as an [MCP](https://modelcontextprotocol.io) server. The business (or its agency) adds one URL to Claude, ChatGPT or Cursor, and the assistant can answer questions about the site, its services, prices and opening hours, with sources.

## Status

Phase 1 (Read tier) foundation:

- [x] Multi-tenant schema with row-level security and pgvector search
- [x] Crawler: sitemap and link discovery, robots.txt, HTML to markdown, optional Firecrawl
- [x] Incremental ingestion: unchanged pages skipped by content hash
- [x] Stateless MCP endpoint per tenant with `search_site`, `get_page`, `list_pages`, `get_business_info`
- [x] Hashed API keys and per-call logging
- [ ] Client dashboard
- [ ] Scheduled re-crawls

## Getting started

1. Create a Supabase project and run the migration in `supabase/migrations/` (SQL editor, or `supabase db push`).
2. `cp .env.example .env.local` and fill in the values.
3. Install and run:

   ```bash
   npm install
   npm run dev
   ```

4. Onboard a client (creates tenant, site and key, then crawls):

   ```bash
   npm run tenant:create -- --slug demo --name "Demo Business" --url https://example.co.uk
   ```

5. Connect it. In Claude: Settings, Connectors, add custom connector, and paste the URL the script prints. Or test with the MCP Inspector:

   ```bash
   npx @modelcontextprotocol/inspector
   ```

## Deploying

Import the repo into Vercel, add the environment variables from `.env.example`, deploy. The MCP endpoint is `https://<your-domain>/api/mcp/<tenant-slug>`.

See `CLAUDE.md` for architecture, conventions and the roadmap.
