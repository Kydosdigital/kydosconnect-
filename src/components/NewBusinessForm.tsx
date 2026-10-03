"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createBusiness, type ActionState } from "@/app/dashboard/actions";
import { SubmitButton } from "./SubmitButton";
import { CopyField } from "./CopyField";

export function NewBusinessForm() {
  const [state, action] = useActionState<ActionState, FormData>(createBusiness, {});

  if (state.newKey && state.slug) {
    return (
      <div className="panel stack">
        <h2>Your website is connecting</h2>
        <p className="muted">
          We are reading your pages now. Small sites take a minute or two; larger ones a little longer.
        </p>
        <div className="stack" style={{ gap: 8 }}>
          <strong>Your access key</strong>
          <CopyField value={state.newKey} label="Access key" />
          <span className="small muted">Copy it now and keep it safe. For security it will not be shown again.</span>
        </div>
        <div>
          <Link className="btn btn-primary" href={`/dashboard/${state.slug}?key=shown`}>
            Continue to set-up
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="panel stack">
      <h2>Add your business</h2>
      <p className="muted">We will read your website so AI assistants can answer questions about it.</p>
      <div className="field">
        <label htmlFor="name">Business name</label>
        <input className="input" id="name" name="name" required autoComplete="organization" placeholder="Physio Matters" />
      </div>
      <div className="field">
        <label htmlFor="url">Website address</label>
        <input className="input" id="url" name="url" required inputMode="url" autoComplete="url" placeholder="physiomatters.co.uk" />
      </div>
      {state.error && <p className="notice notice-error">{state.error}</p>}
      <div>
        <SubmitButton pending="Adding your business">Add business</SubmitButton>
      </div>
    </form>
  );
}
