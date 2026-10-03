import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Wordmark";
import { requireUser } from "@/lib/tenancy";
import { signOut } from "./actions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="shell topbar">
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <Wordmark />
        </Link>
        <form action={signOut} className="row">
          <span className="small muted user-email">{user.email}</span>
          <button type="submit" className="btn btn-link small">
            Sign out
          </button>
        </form>
      </header>
      <main className="shell" style={{ paddingBottom: 80 }}>
        {children}
      </main>
    </>
  );
}
