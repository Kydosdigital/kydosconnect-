import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { requireMembership } from "@/lib/tenancy";
import { BusinessView } from "@/components/BusinessView";
import { recrawl } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await requireMembership(slug);
  return { title: m.name };
}

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await requireMembership(slug);
  const supabase = db();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [{ data: site }, { count: pageCount }, { data: key }, { data: calls }, { count: weekCount }] = await Promise.all([
    supabase.from("sites").select("url, crawl_status, last_crawled_at, last_error").eq("tenant_id", m.tenantId).order("created_at").limit(1).maybeSingle(),
    supabase.from("pages").select("id", { count: "exact", head: true }).eq("tenant_id", m.tenantId),
    supabase.from("api_keys").select("key_prefix").eq("tenant_id", m.tenantId).eq("revoked", false).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("tool_calls").select("id, tool, args, client_name, ok, created_at").eq("tenant_id", m.tenantId).order("created_at", { ascending: false }).limit(12),
    supabase.from("tool_calls").select("id", { count: "exact", head: true }).eq("tenant_id", m.tenantId).gte("created_at", weekAgo),
  ]);

  return (
    <BusinessView
      slug={m.slug}
      name={m.name}
      plan={m.plan}
      canEdit={m.role !== "viewer"}
      profile={m.profile}
      mcpUrl={`${appUrl()}/api/mcp/${m.slug}`}
      keyPrefix={key?.key_prefix ?? null}
      site={site}
      pageCount={pageCount ?? 0}
      weekCount={weekCount ?? 0}
      calls={calls ?? []}
      recrawlAction={recrawl.bind(null, m.slug)}
    />
  );
}
