"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action] = useActionState<LoginState, FormData>(sendMagicLink, {});

  if (state.sentTo) {
    return (
      <div className="stack">
        <h1 style={{ fontSize: "1.75rem" }}>Check your email</h1>
        <p className="muted">
          We sent a sign-in link to <strong>{state.sentTo}</strong>. Open it on this device to continue. It expires in one hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="stack">
      <h1 style={{ fontSize: "1.75rem" }}>Sign in</h1>
      <p className="muted">Enter your email and we will send you a link. No password needed.</p>
      {linkError && <p className="notice notice-error">That sign-in link has expired or was already used. Request a new one below.</p>}
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" autoFocus />
      </div>
      {state.error && <p className="notice notice-error">{state.error}</p>}
      <div>
        <SubmitButton pending="Sending link">Send sign-in link</SubmitButton>
      </div>
    </form>
  );
}
