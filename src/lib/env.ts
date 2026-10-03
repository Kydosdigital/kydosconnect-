const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "ADMIN_SECRET",
] as const;

type RequiredKey = (typeof required)[number];
type OptionalKey = "FIRECRAWL_API_KEY" | "APP_URL";

/** Read a required environment variable, failing loudly if it is missing. */
export function env(key: RequiredKey): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}

export function optionalEnv(key: OptionalKey): string | undefined {
  return process.env[key] || undefined;
}

/**
 * Browser-safe Supabase settings. Next.js inlines NEXT_PUBLIC_ variables only
 * when they are referenced literally, so they are read one by one here.
 */
export function publicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return { url, anonKey };
}

/** Base URL used in connection instructions. */
export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
