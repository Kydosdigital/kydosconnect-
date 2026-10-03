"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { generateKey } from "@/lib/auth";
import { ingestSite } from "@/lib/ingest";
import { normaliseUrl } from "@/lib/crawl";
import { requireMembership, requireUser } from "@/lib/tenancy";
import { supabaseServer } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
  /** Present once, straight after a key is created. Never stored. */
  newKey?: string;
  slug?: string;
  saved?: boolean;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .padEnd(3, "x");
}

async function issueKey(tenantId: string, label: string): Promise<string> {
  const key = generateKey();
  const { error } = await db()
    .from("api_keys")
    .insert({ tenant_id: tenantId, label, key_prefix: key.prefix, key_hash: key.hash });
  if (error) throw new Error(error.message);
  return key.raw;
}

function startCrawl(siteId: string) {
  // Runs after the response is sent, so the page returns straight away
  after(async () => {
    try {
      await ingestSite(siteId);
    } catch (err) {
      console.error(`[crawl] site ${siteId} failed`, err);
    }
  });
}

export async function createBusiness(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  const rawUrl = String(form.get("url") ?? "").trim();
  if (name.length < 2) return { error: "Enter the business name." };
  const url = normaliseUrl(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  if (!url) return { error: "Enter the website address, for example physiomatters.co.uk." };

  const supabase = db();
  let slug = slugify(name);
  const { data: taken } = await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (taken) slug = `${slug.slice(0, 35)}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ slug, name })
    .select("id, slug")
    .single();
  if (tenantError || !tenant) return { error: "The business could not be created. Try again." };

  await supabase.from("tenant_members").insert({ tenant_id: tenant.id, user_id: user.id, role: "owner" });
  const { data: site } = await supabase
    .from("sites")
    .insert({ tenant_id: tenant.id, url })
    .select("id")
    .single();
  const rawKey = await issueKey(tenant.id, "default");
  if (site) startCrawl(site.id);

  revalidatePath("/dashboard");
  return { slug: tenant.slug, newKey: rawKey };
}

export async function createKey(slug: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  const m = await requireMembership(slug, "owner");
  const label = `key-${new Date().toISOString().slice(0, 10)}`;
  // A new key replaces the old ones, so a lost or shared key stops working
  await db().from("api_keys").update({ revoked: true }).eq("tenant_id", m.tenantId).eq("revoked", false);
  const rawKey = await issueKey(m.tenantId, label);
  revalidatePath(`/dashboard/${slug}`);
  return { slug, newKey: rawKey };
}

export async function recrawl(slug: string): Promise<void> {
  const m = await requireMembership(slug, "owner");
  const { data: sites } = await db().from("sites").select("id").eq("tenant_id", m.tenantId);
  for (const site of sites ?? []) {
    await db().from("sites").update({ crawl_status: "pending" }).eq("id", site.id);
    startCrawl(site.id);
  }
  revalidatePath(`/dashboard/${slug}`);
}

const PROFILE_FIELDS = ["phone", "email", "address", "opening_hours", "services", "booking_link", "policies"] as const;

export async function saveProfile(slug: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const m = await requireMembership(slug, "owner");
  const profile: Record<string, string> = {};
  for (const field of PROFILE_FIELDS) {
    const value = String(form.get(field) ?? "").trim().slice(0, 4000);
    if (value) profile[field] = value;
  }
  const { error } = await db().from("tenants").update({ profile }).eq("id", m.tenantId);
  if (error) return { error: "Your details could not be saved. Try again." };
  revalidatePath(`/dashboard/${slug}`);
  return { saved: true };
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
