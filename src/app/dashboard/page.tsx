import Link from "next/link";
import { NewBusinessForm } from "@/components/NewBusinessForm";
import { isAgencyEmail, listMemberships, requireUser } from "@/lib/tenancy";
import { db } from "@/lib/db";
import { planName, statusFor } from "@/lib/present";

export const metadata = { title: "Your businesses" };
// Adding a business reads the website in the background after the response
export const maxDuration = 300;

export default async function DashboardHome() {
  const user = await requireUser();
  const memberships = await listMemberships(user.id, user.email);
  const agency = isAgencyEmail(user.email);

  if (memberships.length === 0) {
    return (
      <div className="stack-l" style={{ maxWidth: 560, paddingTop: 24 }}>
        <div className="stack">
          <h1>Connect your website to AI</h1>
          <p className="muted" style={{ fontSize: "1.125rem" }}>
            Add your business and we will make your website readable by Claude, ChatGPT and other assistants. It takes about two minutes.
          </p>
        </div>
        <NewBusinessForm />
      </div>
    );
  }

  const { data: sites } = await db()
    .from("sites")
    .select("tenant_id, url, crawl_status")
    .in("tenant_id", memberships.map((m) => m.tenantId));
  const siteFor = new Map((sites ?? []).map((s) => [s.tenant_id, s]));

  return (
    <div className="stack-l" style={{ paddingTop: 24 }}>
      <div className="stack" style={{ gap: 6 }}>
        <h1>{agency ? "All client businesses" : "Your businesses"}</h1>
        {agency && (
          <p className="muted">
            You are signed in as Kydos Digital staff, so you can see and manage every business ({memberships.length}).
          </p>
        )}
      </div>
      <ul className="business-list">
        {memberships.map((m) => {
          const site = siteFor.get(m.tenantId);
          const status = statusFor(site?.crawl_status);
          return (
            <li key={m.tenantId}>
              <Link href={`/dashboard/${m.slug}`}>
                <span className="stack" style={{ gap: 2 }}>
                  <strong>{m.name}</strong>
                  <span className="small muted">
                    {site ? new URL(site.url).host : "No website yet"}, {planName(m.plan)} plan
                  </span>
                </span>
                <span className={`status ${status.className}`}>{status.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <details>
        <summary className="btn btn-quiet" style={{ display: "inline-flex", listStyle: "none" }}>
          Add another business
        </summary>
        <div style={{ maxWidth: 560, marginTop: 16 }}>
          <NewBusinessForm />
        </div>
      </details>
    </div>
  );
}
