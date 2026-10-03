import { ConnectPanel } from "@/components/ConnectPanel";
import { ProfileForm } from "@/components/ProfileForm";
import { CrawlWatcher } from "@/components/CrawlWatcher";
import { SubmitButton } from "@/components/SubmitButton";
import { assistantName, describeArgs, describeTool, formatDate, planName, statusFor, timeAgo } from "@/lib/present";

export interface BusinessViewProps {
  slug: string;
  name: string;
  plan: string;
  canEdit: boolean;
  profile: Record<string, string>;
  mcpUrl: string;
  keyPrefix: string | null;
  site: { url: string; crawl_status: string; last_crawled_at: string | null; last_error: string | null } | null;
  pageCount: number;
  weekCount: number;
  calls: { id: number; tool: string; args: Record<string, unknown> | null; client_name: string | null; ok: boolean; created_at: string }[];
  recrawlAction: () => Promise<void>;
}

export function BusinessView(p: BusinessViewProps) {
  const status = statusFor(p.site?.crawl_status);
  const busy = p.site?.crawl_status === "crawling" || p.site?.crawl_status === "pending";
  const host = p.site ? new URL(p.site.url).host : null;

  return (
    <div className="stack-l" style={{ paddingTop: 16 }}>
      <CrawlWatcher active={busy} />

      <div className="stack" style={{ gap: 8 }}>
        <h1>{p.name}</h1>
        <p className="muted">{planName(p.plan)} plan</p>
      </div>

      {/* The wire: website on the left, assistants on the right, the connection between */}
      <section className="wire" aria-label="Connection status">
        <div className="wire-end">
          <strong>{host ?? "Your website"}</strong>
          <span className="small muted">
            {p.pageCount} {p.pageCount === 1 ? "page" : "pages"} read
            {p.site?.last_crawled_at ? `, ${timeAgo(p.site.last_crawled_at)}` : ""}
          </span>
        </div>
        <div className="wire-line" data-live={status.live}>
          <span className="wire-label">{p.mcpUrl.replace(/^https?:\/\//, "")}</span>
          <span className={`wire-note status ${status.className}`}>{status.label}</span>
        </div>
        <div className="wire-end">
          <strong>AI assistants</strong>
          <span className="small muted">
            {p.weekCount} {p.weekCount === 1 ? "request" : "requests"} this week
          </span>
        </div>
      </section>

      {p.site?.crawl_status === "failed" && (
        <p className="notice notice-warn">
          We could not read {host}. {p.site.last_error ? `The reason given was: ${p.site.last_error}.` : ""} Check the site is online,
          then read it again. If it keeps failing, contact Kydos Digital.
        </p>
      )}

      <div className="split">
        <div className="stack-l">
          {p.canEdit && <ConnectPanel slug={p.slug} mcpUrl={p.mcpUrl} keyPrefix={p.keyPrefix} />}

          <section className="panel" aria-labelledby="activity-heading">
            <div className="panel-head">
              <h2 id="activity-heading">What AI assistants asked</h2>
            </div>
            {p.calls.length > 0 ? (
              <ul className="activity">
                {p.calls.map((c) => {
                  const detail = describeArgs(c.args);
                  return (
                    <li key={c.id}>
                      <span className="what">
                        {assistantName(c.client_name)}: {describeTool(c.tool).toLowerCase()}
                        {!c.ok && <span className="faint"> (failed)</span>}
                      </span>
                      <time className="when" dateTime={c.created_at} title={formatDate(c.created_at)}>
                        {timeAgo(c.created_at)}
                      </time>
                      {detail && <span className="detail">{detail}</span>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">
                Nothing yet. Connect an assistant above, then ask it a question about {p.name}. Each request will show up here.
              </p>
            )}
          </section>
        </div>

        <div className="stack-l">
          {p.canEdit && <ProfileForm slug={p.slug} profile={p.profile} />}

          {p.canEdit && p.site && (
            <section className="panel stack" aria-labelledby="website-heading">
              <h2 id="website-heading">Your website</h2>
              <p className="muted small">
                We read {host} every week. If you have just changed something important, read it now so assistants see the update.
              </p>
              <form action={p.recrawlAction}>
                {busy ? (
                  <button type="button" className="btn btn-quiet" disabled>
                    Reading your website
                  </button>
                ) : (
                  <SubmitButton variant="quiet" pending="Starting">
                    Read website again
                  </SubmitButton>
                )}
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
