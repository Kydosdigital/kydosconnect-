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
