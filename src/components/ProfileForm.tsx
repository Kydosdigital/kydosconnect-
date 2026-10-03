"use client";

import { useActionState } from "react";
import { saveProfile, type ActionState } from "@/app/dashboard/actions";
import { SubmitButton } from "./SubmitButton";

const FIELDS: { name: string; label: string; hint?: string; long?: boolean; placeholder?: string }[] = [
  { name: "opening_hours", label: "Opening hours", long: true, placeholder: "Mon to Fri 9am to 7pm\nSat 9am to 1pm\nClosed Sundays and bank holidays" },
  { name: "phone", label: "Phone", placeholder: "0161 000 0000" },
  { name: "email", label: "Email", placeholder: "hello@yourbusiness.co.uk" },
  { name: "address", label: "Address", long: true },
  { name: "services", label: "Services and prices", long: true, hint: "One per line. AI assistants quote these exactly." },
  { name: "booking_link", label: "Booking link", placeholder: "https://" },
  { name: "policies", label: "Policies", long: true, hint: "Cancellations, refunds, parking, accessibility." },
];

/**
 * Facts the business confirms itself. These outrank anything read from the
 * website, so out-of-date pages do not give customers wrong hours or prices.
 */
export function ProfileForm({ slug, profile }: { slug: string; profile: Record<string, string> }) {
  const [state, action] = useActionState<ActionState, FormData>(saveProfile.bind(null, slug), {});

  return (
    <form action={action} className="panel stack" aria-labelledby="profile-heading">
      <div className="stack" style={{ gap: 6 }}>
        <h2 id="profile-heading">Business details</h2>
        <p className="muted small">AI assistants use these first, so keep them current even if your website is out of date.</p>
      </div>
      {FIELDS.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={f.name}>{f.label}</label>
          {f.long ? (
            <textarea className="textarea" id={f.name} name={f.name} defaultValue={profile[f.name] ?? ""} placeholder={f.placeholder} />
          ) : (
            <input className="input" id={f.name} name={f.name} defaultValue={profile[f.name] ?? ""} placeholder={f.placeholder} />
          )}
          {f.hint && <span className="hint">{f.hint}</span>}
        </div>
      ))}
      {state.error && <p className="notice notice-error">{state.error}</p>}
      {state.saved && <p className="notice notice-ok">Details saved. AI assistants will use them from now on.</p>}
      <div>
        <SubmitButton pending="Saving details">Save details</SubmitButton>
      </div>
    </form>
  );
}
