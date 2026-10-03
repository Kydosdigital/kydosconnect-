import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";

export const KEY_PREFIX = "kc_live_";

export interface TenantContext {
  tenantId: string;
  slug: string;
  name: string;
  plan: "starter" | "growth" | "pro";
  profile: Record<string, unknown>;
  apiKeyId: string;
}

export const hashKey = (raw: string) => createHash("sha256").update(raw).digest("hex");

/** Create a new random MCP key. The raw key is returned once and never stored. */
export function generateKey(): { raw: string; prefix: string; hash: string } {
  const raw = KEY_PREFIX + randomBytes(24).toString("base64url");
  return { raw, prefix: raw.slice(0, KEY_PREFIX.length + 6), hash: hashKey(raw) };
}

/** Pull the key from "Authorization: Bearer <key>" (or ?key= for clients that cannot set headers). */
export function extractKey(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const fromQuery = new URL(req.url).searchParams.get("key");
  return fromQuery?.trim() || null;
}

/**
 * Resolve the tenant for an MCP request. The key must belong to the tenant
 * named in the URL, so a key leaked for one client can never read another.
 */
export async function authenticate(req: Request, tenantSlug: string): Promise<TenantContext | null> {
  const raw = extractKey(req);
  if (!raw || !raw.startsWith(KEY_PREFIX)) return null;

  const supabase = db();
  const { data: key } = await supabase
    .from("api_keys")
    .select("id, tenant_id, key_hash, revoked, tenants!inner(id, slug, name, plan, profile)")
    .eq("key_hash", hashKey(raw))
    .maybeSingle();
  if (!key || key.revoked) return null;

  const tenant = (Array.isArray(key.tenants) ? key.tenants[0] : key.tenants) as {
    id: string;
    slug: string;
    name: string;
    plan: TenantContext["plan"];
    profile: Record<string, unknown>;
  };
  if (!tenant || tenant.slug !== tenantSlug) return null;

  // Fire and forget: usage timestamp is not worth blocking the request for
  void supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    plan: tenant.plan,
    profile: tenant.profile ?? {},
    apiKeyId: key.id,
  };
}

/** Guard for internal admin routes. */
export function isAdmin(req: Request, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
