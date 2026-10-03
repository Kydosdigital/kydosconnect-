import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticate } from "@/lib/auth";
import { buildServer } from "@/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ tenant: string }> };

function unauthorised(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Invalid or missing Kydos Connect key" },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="kydos-connect"',
      },
    },
  );
}

/**
 * Streamable HTTP MCP endpoint, one per tenant: /api/mcp/{tenant-slug}
 * Stateless: each request builds a fresh server, so it scales on serverless.
 */
async function handle(req: Request, { params }: Params): Promise<Response> {
  const { tenant: slug } = await params;
  const tenant = await authenticate(req, slug);
  if (!tenant) return unauthorised();

  const server = buildServer(tenant, { clientName: req.headers.get("user-agent")?.slice(0, 120) ?? null });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // JSON responses are fully buffered, so it is safe to close once handled
    void transport.close();
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };
