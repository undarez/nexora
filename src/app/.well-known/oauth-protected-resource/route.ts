import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getResourceUrl() {
  const explicit = process.env.NEXORA_MCP_RESOURCE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return `${appUrl.replace(/\/$/, "")}/api/mcp`;
  return null;
}

function getAuthorizationServer() {
  const value = process.env.NEXORA_MCP_AUTHORIZATION_SERVER_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

export async function GET() {
  const resource = getResourceUrl();
  const authorizationServer = getAuthorizationServer();

  if (!resource || !authorizationServer) {
    return NextResponse.json(
      {
        error: "mcp_oauth_not_configured",
        message:
          "Configure NEXORA_MCP_RESOURCE_URL and NEXORA_MCP_AUTHORIZATION_SERVER_URL before exposing NEXORA MCP OAuth metadata.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      resource,
      authorization_servers: [authorizationServer],
      scopes_supported: ["mcp"],
      resource_documentation: `${resource.replace(/\/api\/mcp$/, "")}/docs/mcp`,
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
