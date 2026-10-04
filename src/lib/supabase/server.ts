import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client bound to the signed-in user's session (anon key + cookies).
 * Use for auth only; data access goes through db() after a membership check.
 *
 * flowType "implicit" is used when sending sign-in emails: the link then works in
 * whichever browser opens it (e.g. Gmail's built-in browser), not only the one that asked.
 */
export async function supabaseServer(flowType: "pkce" | "implicit" = "pkce") {
  const cookieStore = await cookies();
  const { url, anonKey } = publicEnv();
  return createServerClient(url, anonKey, {
    auth: { flowType },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. proxy.ts refreshes sessions.
        }
      },
    },
  });
}
