"use client";

import { useActionState } from "react";
import { createKey, type ActionState } from "@/app/dashboard/actions";
import { SubmitButton } from "./SubmitButton";
import { ConnectSteps } from "./ConnectSteps";
import { CopyField } from "./CopyField";

/** Connection instructions plus key management. A new key is shown once, here. */
export function ConnectPanel({ slug, mcpUrl, keyPrefix }: { slug: string; mcpUrl: string; keyPrefix: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(createKey.bind(null, slug), {});

  return (
    <section className="panel" aria-labelledby="connect-heading">
      <div className="panel-head">
        <h2 id="connect-heading">Connect an AI assistant</h2>
      </div>

      {state.newKey && (
        <div className="notice notice-ok stack" style={{ marginBottom: 20 }}>
          <strong>Your new access key</strong>
          <CopyField value={state.newKey} label="New access key" />
          <span className="small">Copy it now. For security it will not be shown again, and your old key has stopped working.</span>
        </div>
      )}

      <ConnectSteps mcpUrl={mcpUrl} rawKey={state.newKey} />

      <form action={action} className="row" style={{ marginTop: 24, justifyContent: "space-between" }}>
        <span className="small muted">
          {keyPrefix ? (
            <>
              Current key starts <code>{keyPrefix}</code>
            </>
          ) : (
            "No active key"
          )}
        </span>
        <SubmitButton variant="quiet" pending="Creating key">
          Create new key
        </SubmitButton>
      </form>
      {state.error && <p className="notice notice-error">{state.error}</p>}
    </section>
  );
}
