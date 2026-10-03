import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The MCP route and crawler run on the Node.js runtime.
  serverExternalPackages: ["cheerio"],
};

export default nextConfig;
