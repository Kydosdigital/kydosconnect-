/** Turning stored values into words people understand. */

export function planName(plan: string): string {
  return { starter: "Starter", growth: "Growth", pro: "Pro" }[plan] ?? plan;
}

export function statusFor(crawl?: string | null): { label: string; className: string; live: boolean } {
  switch (crawl) {
    case "ready":
      return { label: "Connected", className: "status-live", live: true };
    case "crawling":
      return { label: "Reading your website", className: "status-busy", live: false };
    case "pending":
      return { label: "Waiting to read your website", className: "status-busy", live: false };
    case "failed":
      return { label: "Needs attention", className: "status-off", live: false };
    default:
      return { label: "Not set up", className: "status-off", live: false };
  }
}

const TOOL_WORDS: Record<string, string> = {
  search_site: "Searched your website",
  get_page: "Read a page",
  list_pages: "Listed your pages",
  get_business_info: "Checked your business details",
};

export function describeTool(tool: string): string {
  return TOOL_WORDS[tool] ?? tool.replace(/_/g, " ");
}

export function describeArgs(args: Record<string, unknown> | null): string | null {
  if (!args) return null;
  if (typeof args.query === "string") return `“${args.query}”`;
  if (typeof args.url === "string") return args.url;
  if (typeof args.contains === "string") return `Pages about “${args.contains}”`;
  return null;
}

/** Best guess at which assistant made the call, from its user agent. */
export function assistantName(clientName: string | null): string {
  const ua = (clientName ?? "").toLowerCase();
  if (ua.includes("claude") || ua.includes("anthropic")) return "Claude";
  if (ua.includes("openai") || ua.includes("chatgpt")) return "ChatGPT";
  if (ua.includes("cursor")) return "Cursor";
  return "An AI assistant";
}

const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
