/**
 * Re-crawl every site for a tenant:  npm run crawl -- --slug physio-matters
 */
import { parseArgs } from "node:util";
import { db } from "../src/lib/db";
import { ingestSite } from "../src/lib/ingest";

async function main() {
  const { values } = parseArgs({ options: { slug: { type: "string" } } });
  if (!values.slug) {
    console.error("Usage: npm run crawl -- --slug my-client");
    process.exit(1);
  }
  const { data: tenant } = await db().from("tenants").select("id").eq("slug", values.slug).single();
  if (!tenant) throw new Error(`No tenant with slug ${values.slug}`);
  const { data: sites } = await db().from("sites").select("id, url").eq("tenant_id", tenant.id);
  for (const site of sites ?? []) {
    console.log(`Crawling ${site.url} ...`);
    console.log(await ingestSite(site.id));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
