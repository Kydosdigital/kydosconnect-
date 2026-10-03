import "server-only";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "owner" | "agency" | "viewer";

export interface Membership {
  tenantId: string;
  slug: string;
  name: string;
  plan: "starter" | "growth" | "pro";
  profile: Record<string, string>;
  role: Role;
}

/** The signed-in user, or a redirect to the login page. */
export async function requireUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

/** Every business the user belongs to. */
export async function listMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await db()
    .from("tenant_members")
    .select("role, tenants!inner(id, slug, name, plan, profile)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const t = (Array.isArray(row.tenants) ? row.tenants[0] : row.tenants) as {
      id: string;
      slug: string;
      name: string;
      plan: Membership["plan"];
      profile: Record<string, string> | null;
    };
    return { tenantId: t.id, slug: t.slug, name: t.name, plan: t.plan, profile: t.profile ?? {}, role: row.role as Role };
  });
}

/**
 * The user's membership of one business. Every dashboard page and action calls
 * this before touching data, because db() uses the service role and bypasses RLS.
 */
export async function requireMembership(slug: string, minimumRole: Role = "viewer"): Promise<{ userId: string } & Membership> {
  const user = await requireUser();
  const memberships = await listMemberships(user.id);
  const match = memberships.find((m) => m.slug === slug);
  if (!match) notFound();
  const rank: Record<Role, number> = { viewer: 0, owner: 1, agency: 2 };
  if (rank[match.role] < rank[minimumRole]) notFound();
  return { userId: user.id, ...match };
}
