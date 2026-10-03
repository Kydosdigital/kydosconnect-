export default function Home() {
  return (
    <main>
      <h1>Kydos Connect</h1>
      <p>Your website, working inside every AI assistant. Read it, measure it, manage it. Just ask.</p>
      <p>
        The client dashboard is coming in the next sprint. For now, tenants are created with{" "}
        <code>npm run tenant:create</code> and connect at <code>/api/mcp/&#123;tenant&#125;</code>.
      </p>
    </main>
  );
}
