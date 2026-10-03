"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While a crawl is running, refresh the page every few seconds to show progress. */
export function CrawlWatcher({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
