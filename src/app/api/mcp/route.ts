import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createMcpHandler, OAuthError, OAuthErrorCode, requireBearerAuth } from "@modelcontextprotocol/server";
import { createNexoraMcpServer } from "@/lib/mcp/nexora-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_not_configured");
  return { url, key };
}

const bearerGate = requireBearerAuth({
  requiredScopes: ["mcp"],
  resourceMetadataUrl: `${(process.env.NEXORA_MCP_RESOURCE_URL ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/mcp`).replace(/\/$/, "")}/../.well-known/oauth-protected-resource`,
  verifier: {
    async verifyAccessToken(token) {
      const { url, key } = getSupabaseConfig();
      const supabase = createSupabaseClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) throw new OAuthError(OAuthErrorCode.InvalidToken, "Jeton NEXORA invalide ou expiré.");
      return {
        token,
        clientId: "nexora-mcp",
        scopes: ["mcp"],
        expiresAt: Math.floor(Date.now() / 1000) + 300,
        extra: { userId: data.user.id },
      };
    },
  },
});

const handler = createMcpHandler(
  async ({ authInfo }) => {
    const userId = typeof authInfo?.extra?.userId === "string" ? authInfo.extra.userId : null;
    if (!userId) throw new Error("mcp_identity_missing");
    const { url, key } = getSupabaseConfig();
    const token = authInfo?.token;
    if (!token) throw new Error("mcp_token_missing");
    const supabase = createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    return createNexoraMcpServer(supabase, userId);
  },
  { legacy: "reject" },
);

export async function POST(request: Request) {
  try {
    const auth = await bearerGate(request);
    if (auth instanceof Response) return auth;
    return await handler.fetch(request, { authInfo: auth });
  } catch (error) {
    console.error("[NEXORA MCP] request failed", error);
    return NextResponse.json({ error: "mcp_unavailable" }, { status: 503 });
  }
}
