import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createMcpHandler, OAuthError, OAuthErrorCode, requireBearerAuth } from "@modelcontextprotocol/server";
import { createNexoraMcpServer } from "@/lib/mcp/nexora-server";
import { getLiaPrincipal } from "@/lib/security/agent-identity";
import { verifyNanobotExecutionContext } from "@/lib/security/nanobot-execution-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("supabase_not_configured");
  return { url, key };
}

function getSupabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("supabase_server_configuration_missing");
  return { url, key };
}

const bearerGate = requireBearerAuth({
  requiredScopes: ["mcp"],
  resourceMetadataUrl: `${(process.env.NEXORA_MCP_RESOURCE_METADATA_URL ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/.well-known/oauth-protected-resource`).replace(/\/$/, "")}`,
  verifier: {
    async verifyAccessToken(token) {
      if (token.startsWith("nbx1.")) {
        const executionContext = await verifyNanobotExecutionContext(token);
        if (!executionContext) throw new OAuthError(OAuthErrorCode.InvalidToken, "Contexte Nanobot NEXORA invalide, expiré ou révoqué.");
        const principal = getLiaPrincipal(executionContext.userId);
        if (principal.agentId !== executionContext.agentId || principal.organizationId !== executionContext.organizationId) {
          throw new OAuthError(OAuthErrorCode.InvalidToken, "Identité LIA du contexte Nanobot incohérente.");
        }
        return {
          token,
          clientId: "nexora-nanobot",
          scopes: ["mcp"],
          expiresAt: executionContext.expiresAt,
          extra: { userId: executionContext.userId, nanobot: true, executionContext },
        };
      }

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
        extra: { userId: data.user.id, nanobot: false },
      };
    },
  },
});

const handler = createMcpHandler(
  async ({ authInfo }) => {
    const userId = typeof authInfo?.extra?.userId === "string" ? authInfo.extra.userId : null;
    if (!userId) throw new Error("mcp_identity_missing");

    const isNanobot = authInfo?.extra?.nanobot === true;
    const executionContext = isNanobot ? authInfo.extra?.executionContext : null;

    if (isNanobot && (!executionContext || executionContext.userId !== userId)) {
      throw new Error("nanobot_identity_mismatch");
    }

    const { url, key } = isNanobot ? getSupabaseAdminConfig() : getSupabaseConfig();
    const token = authInfo?.token;
    if (!token) throw new Error("mcp_token_missing");

    const supabase = createSupabaseClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(!isNanobot ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });

    return createNexoraMcpServer(
      supabase,
      userId,
      isNanobot && executionContext
        ? {
            goalId: executionContext.goalId,
            runId: executionContext.runId,
            sessionId: executionContext.sessionId,
            autonomyCeiling: executionContext.autonomyLevel,
          }
        : undefined,
    );
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
