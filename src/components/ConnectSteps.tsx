"use client";

import { useState } from "react";
import { CopyField } from "./CopyField";

type Client = "claude" | "chatgpt" | "cursor";

/**
 * Step-by-step instructions per assistant. The key is only known straight after
 * it is created, so otherwise the URL shows a placeholder.
 */
export function ConnectSteps({ mcpUrl, rawKey }: { mcpUrl: string; rawKey?: string }) {
  const [client, setClient] = useState<Client>("claude");
  const keyValue = rawKey ?? "YOUR_KEY";
  const urlWithKey = `${mcpUrl}?key=${keyValue}`;
  const cursorConfig = JSON.stringify(
    { mcpServers: { "my-website": { url: mcpUrl, headers: { Authorization: `Bearer ${keyValue}` } } } },
    null,
    2,
  );

  const tabs: { id: Client; name: string }[] = [
    { id: "claude", name: "Claude" },
    { id: "chatgpt", name: "ChatGPT" },
    { id: "cursor", name: "Cursor" },
  ];

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Choose your AI assistant">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={client === t.id}
            aria-controls={`connect-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => setClient(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {client === "claude" && (
        <div role="tabpanel" id="connect-claude" aria-labelledby="tab-claude" className="stack">
          <ol className="steps">
            <li>In Claude, open Settings and go to Connectors.</li>
            <li>Choose Add custom connector and give it your business name.</li>
            <li>Paste this address and save.</li>
          </ol>
          <CopyField value={urlWithKey} label="Connector address for Claude" />
          <p className="small muted">Then ask something like &ldquo;What are our opening hours?&rdquo; to check it works.</p>
        </div>
      )}

      {client === "chatgpt" && (
        <div role="tabpanel" id="connect-chatgpt" aria-labelledby="tab-chatgpt" className="stack">
          <ol className="steps">
            <li>In ChatGPT, open Settings and find Connectors (available on supported plans).</li>
            <li>Create a new custom connector and give it your business name.</li>
            <li>Paste this address as the server URL and save.</li>
          </ol>
          <CopyField value={urlWithKey} label="Connector address for ChatGPT" />
        </div>
      )}

      {client === "cursor" && (
        <div role="tabpanel" id="connect-cursor" aria-labelledby="tab-cursor" className="stack">
          <p>Add this to your Cursor MCP settings file:</p>
          <CopyField value={cursorConfig} label="Cursor configuration" />
        </div>
      )}

      {!rawKey && (
        <p className="small faint" style={{ marginTop: 16 }}>
          Replace YOUR_KEY with your access key. Lost it? Create a new one below.
        </p>
      )}
    </div>
  );
}
