"use server";

import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

export interface LoginState {
  error?: string;
  sentTo?: string;
}

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const next = String(form.get("next") ?? "/dashboard");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await supabaseServer("implicit");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next.startsWith("/") ? next : "/dashboard")}`,
    },
  });
  if (error) return { error: "The sign-in link could not be sent. Wait a minute and try again." };
  return { sentTo: email };
}
