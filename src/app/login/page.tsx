import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="auth-wrap">
      <div className="auth-card stack-l">
        <Link href="/" style={{ textDecoration: "none" }}>
          <Wordmark />
        </Link>
        <div className="panel">
          <LoginForm next={next && next.startsWith("/") ? next : "/dashboard"} linkError={error === "link"} />
        </div>
      </div>
    </main>
  );
}
