export default function McpDocumentationPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">NEXORA MCP</h1>
      <p className="mt-4 text-muted-foreground">
        NEXORA exposes a governed MCP server for authenticated financial
        context and LIA capabilities. Access remains scoped to the
        authenticated user and protected by NEXORA policy gates.
      </p>
      <section className="mt-8 space-y-3">
        <h2 className="text-xl font-medium">Endpoint</h2>
        <code className="block rounded-md border p-4">/api/mcp</code>
        <p className="text-sm text-muted-foreground">
          Remote clients must use HTTPS and authenticate with an access token
          carrying the <code>mcp</code> scope.
        </p>
      </section>
    </main>
  );
}
