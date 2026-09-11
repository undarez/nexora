import "@/lib/banking/providers";
import { getMobileAuth, mobileAuthResponse } from "@/lib/auth/mobile";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getBankingProvider } from "@/lib/banking/provider-registry";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Requête refusée." }, { status: 403 }); }
  try {
    const auth = await getMobileAuth(request);
    if (!auth) return mobileAuthResponse();
    const body = await request.json().catch(() => ({})) as { provider?: string; workspaceId?: string; connectionId?: string; mode?: "connect" | "reconnect" | "manage" };
    const providerName = body.provider?.trim();
    if (!providerName) return Response.json({ error: "Fournisseur Open Banking requis." }, { status: 400 });
    const workspaceId = typeof body.workspaceId === "string" && body.workspaceId.trim() ? body.workspaceId.trim() : null;
    if (workspaceId) {
      const { data: membership, error } = await auth.supabase.from("financial_workspace_members").select("workspace_id").eq("workspace_id", workspaceId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
      if (error) return Response.json({ error: "Impossible de vérifier l'espace financier." }, { status: 500 });
      if (!membership) return Response.json({ error: "Accès à cet espace financier refusé." }, { status: 403 });
    }
    const adapter = getBankingProvider(providerName);
    if (!adapter?.createConnectionUrl) return Response.json({ error: "Fournisseur Open Banking indisponible." }, { status: 503 });
    const callbackPath = adapter.callbackPath ?? "/api/banking/callback";
    const redirectUrl = new URL(callbackPath, request.url);
    redirectUrl.searchParams.set("client", "android");
    const redirectUri = redirectUrl.toString();
    const authorizationUrl = await adapter.createConnectionUrl({ userId: auth.user.id, workspaceId, redirectUri, connectionId: body.connectionId, mode: body.mode ?? "connect" });
    return Response.json({ provider: providerName, authorizationUrl, rawCredentialsAccepted: false });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Connexion bancaire impossible." }, { status: 500 });
  }
}
