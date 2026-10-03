/**
 * Onboard a client from the command line (until the dashboard exists).
 *
 *   npm run tenant:create -- --slug physio-matters --name "Physio Matters" --url https://example.co.uk [--plan starter]
 *
 * Creates the tenant, its site and an MCP key, then crawls the site.
 * The raw key is printed once: store it somewhere safe.
 */
import { parseArgs } from "node:util";
import { db } from "../src/lib/db";
import { generateKey } from "../src/lib/auth";
import { ingestSite } from "../src/lib/ingest";
import { appUrl } from "../src/lib/env";

async function main() {
  const { values } = parseArgs({
    options: {
      slug: { type: "string" },
      name: { type: "string" },
      url: { type: "string" },
      plan: { type: "string", default: "starter" },
      "max-pages": { type: "string", default: "100" },
      "skip-crawl": { type: "boolean", default: false },
    },
  });
  if (!values.slug || !values.name || !values.url) {
    console.error('Usage: npm run tenant:create -- --slug my-client --name "My Client" --url https://example.com [--plan starter|growth|pro]');
    process.exit(1);
  }

  const supabase = db();
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ slug: values.slug, name: values.name, plan: values.plan })
    .select("id, slug")
    .single();
  if (tenantError || !tenant) throw new Error(`Could not create tenant: ${tenantError?.message}`);

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .insert({ tenant_id: tenant.id, url: values.url, max_pages: Number(values["max-pages"]) })
    .select("id")
    .single();
  if (siteError || !site) throw new Error(`Could not create site: ${siteError?.message}`);

  const key = generateKey();
  const { error: keyError } = await supabase
    .from("api_keys")
    .insert({ tenant_id: tenant.id, label: "default", key_prefix: key.prefix, key_hash: key.hash });
  if (keyError) throw new Error(`Could not create key: ${keyError.message}`);

  const base = appUrl();
  console.log("\nTenant created.");
  console.log(`  MCP URL:  ${base}/api/mcp/${tenant.slug}`);
  console.log(`  Key:      ${key.raw}   (shown once, store it safely)`);
  console.log(`  Claude:   add a custom connector with URL ${base}/api/mcp/${tenant.slug}?key=${key.raw}\n`);

  if (!values["skip-crawl"]) {
    console.log(`Crawling ${values.url} ...`);
    const result = await ingestSite(site.id);
    console.log(result);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
