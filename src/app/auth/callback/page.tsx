"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Wordmark } from "@/components/Wordmark";

/**
 * Where sign-in links land. Supabase puts the session in the URL fragment
 * (#access_token=...), which only the browser can see, so this page is client-side.
 * It stores the session in cookies, so the server sees the user straight away.
 */
export default function AuthCallback() {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) return setProblem("Sign-in is not configured on this site yet.");

      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const nextParam = query.get("next") ?? "/dashboard";
      const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

      const linkError = hash.get("error_description") ?? query.get("error_description");
      if (linkError) {
        return setProblem(
          /expired|invalid/i.test(linkError)
            ? "That sign-in link has expired or was already used. Each link works once."
            : linkError,
        );
      }

      const supabase = createBrowserClient(url, anonKey, { auth: { flowType: "implicit" } });
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");

      let error: { message: string } | null = null;
      if (accessToken && refreshToken) {
        ({ error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
      } else if (code) {
        // Links requested before this change used a one-browser code; try it in case this is that browser
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else {
        error = { message: "missing" };
      }

      if (error) return setProblem("We could not sign you in with that link. Request a new one and use it within an hour.");
      window.location.replace(next);
    };
    void run();
  }, []);

  return (
    <main className="auth-wrap">
      <div className="auth-card stack-l">
        <Wordmark />
        <div className="panel stack">
          {problem ? (
            <>
              <h1 style={{ fontSize: "1.5rem" }}>Sign-in link did not work</h1>
              <p className="muted">{problem}</p>
              <div>
                <Link className="btn btn-primary" href="/login">
                  Send a new link
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: "1.5rem" }}>Signing you in</h1>
              <p className="muted">One moment.</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
