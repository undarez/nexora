import { NextResponse } from "next/server";
import "@/lib/banking/providers";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getBankingProvider } from "@/lib/banking/provider-registry";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    const body = await request.json().catch(() => ({})) as { provider?: string; workspaceId?: string; connectionId?: string; mode?: "connect" | "reconnect" | "manage" };
    const providerName = body.provider?.trim();
    if (!providerName) return NextResponse.json({ error: "Fournisseur Open Banking requis." }, { status: 400 });
    const workspaceId = typeof body.workspaceId === "string" && body.workspaceId.trim() ? body.workspaceId.trim() : null;
    if (workspaceId) {
      const { data: membership, error: membershipError } = await supabase.from("financial_workspace_members").select("workspace_id").eq("workspace_id", workspaceId).eq("user_id", user.id).eq("status", "active").maybeSingle();
      if (membershipError) return NextResponse.json({ error: "Impossible de vérifier l'espace financier." }, { status: 500 });
      if (!membership) return NextResponse.json({ error: "Accès à cet espace financier refusé." }, { status: 403 });
    }
    const adapter = getBankingProvider(providerName);
    if (!adapter) {
      return NextResponse.json({ error: "Aucun fournisseur Open Banking n'est actuellement activé.", provider: providerName, connectionCreated: false, rawCredentialsAccepted: false }, { status: 503 });
    }
    if (!adapter.createConnectionUrl) {
      return NextResponse.json({ error: `Le fournisseur ${providerName} n'expose pas de flux de connexion bancaire.`, provider: providerName, connectionCreated: false, rawCredentialsAccepted: false }, { status: 422 });
    }
    const callbackPath = adapter.callbackPath ?? "/api/banking/callback";
    const configuredRedirect = process.env.POWENS_REDIRECT_URI?.trim();
    let redirectUri: string;
    try {
      redirectUri = configuredRedirect ? new URL(configuredRedirect).toString() : new URL(callbackPath, request.url).toString();
    } catch {
      return NextResponse.json({ error: "POWENS_REDIRECT_URI est invalide. Utilise une URL HTTPS absolue vers le callback Powens." }, { status: 500 });
    }
    const url = await adapter.createConnectionUrl({ userId: user.id, workspaceId, redirectUri, connectionId: body.connectionId, mode: body.mode ?? "connect" });
    return NextResponse.json({ provider: providerName, authorizationUrl: url, rawCredentialsAccepted: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connexion bancaire impossible." }, { status: 500 });
  }
}
