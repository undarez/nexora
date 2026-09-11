import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import "@/lib/banking/providers";
import { getBankingProvider } from "@/lib/banking/provider-registry";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idConnection = url.searchParams.get("id_connection") ?? url.searchParams.get("connection_id");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const clientHint = url.searchParams.get("client");
  const isAndroidClient = clientHint === "android";
  let redirect = isAndroidClient ? new URL("nexora://auth") : new URL("/banque", url.origin);
  if (error) {
    redirect.searchParams.set("bank_error", error);
    if (errorDescription) redirect.searchParams.set("bank_error_description", errorDescription.slice(0, 240));
  }
  if (!state) {
    redirect.searchParams.set("bank_error", error ?? "callback_invalide");
    return NextResponse.redirect(redirect);
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase serveur indisponible." }, { status: 503 });
  const { data: rows, error: queryError } = await admin.from("bank_connections")
    .select("id,user_id,workspace_id,metadata,status")
    .eq("provider", "powens").in("status", ["pending", "needs_reauth", "error"]);
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  const nowMs = Date.now();
  const match = (rows ?? []).find((row: any) => {
    if (row.metadata?.oauth_state !== state) return false;
    const created = Date.parse(String(row.metadata?.state_created_at ?? ""));
    return Number.isFinite(created) && nowMs - created <= 15 * 60 * 1000;
  });
  if (!match) {
    redirect.searchParams.set("bank_error", "state_invalide_ou_expire");
    return NextResponse.redirect(redirect);
  }
  const flow = String(match.metadata?.flow ?? "connect");
  const isAndroidFlow = String(match.metadata?.client ?? "") === "android" || isAndroidClient;
  if (match.workspace_id && !isAndroidFlow) redirect = new URL("/entreprise", url.origin);
  if (isAndroidFlow) redirect = new URL("nexora://auth");
  const resolvedConnectionId = idConnection ?? (flow === "reconnect" || flow === "manage" ? String(match.metadata?.external_connection_id ?? "") : "");
  if (error || !resolvedConnectionId) {
    await admin.from("bank_connections").update({ status: error === "access_denied" ? "disconnected" : "error", error_code: error ?? "CALLBACK_INVALID", error_message: errorDescription?.slice(0, 500) ?? null, updated_at: new Date().toISOString() }).eq("id", match.id).eq("user_id", match.user_id);
    redirect.searchParams.set("bank_error", error ?? "callback_invalide");
    return NextResponse.redirect(redirect);
  }
  const nowIso = new Date().toISOString();
  // Consume the one-time state before any provider lookup so a callback cannot be replayed.
  const metadata = { ...(match.metadata ?? {}), external_connection_id: resolvedConnectionId, callback_completed: true, callback_completed_at: nowIso, oauth_state: null, state_consumed_at: nowIso };
  const { error: correlationError } = await admin.from("bank_connections").update({ external_connection_id: resolvedConnectionId, metadata, updated_at: nowIso }).eq("id", match.id).eq("user_id", match.user_id).eq("status", match.status);
  if (correlationError) return NextResponse.json({ error: correlationError.message }, { status: 500 });
  let status: "active" | "needs_reauth" | "error" = "active";
  let providerState: string | null = null;
  let institutionName: string | null = null;
  let consentExpiresAt: string | null = null;
  try {
    const adapter = getBankingProvider("powens");
    if (adapter?.getConnectionState) {
      const state = await adapter.getConnectionState({ connectionId: match.id, userId: match.user_id });
      providerState = state.state;
      institutionName = state.institutionName ?? null;
      consentExpiresAt = state.consentExpiresAt ?? null;
      if (state.state && ["SCARequired", "webauthRequired", "wrongpass", "decoupled"].includes(state.state)) status = "needs_reauth";
      else if (state.state && state.state !== "ok" && state.state !== "null") status = "error";
    }
  } catch {
    // The callback is still correlated safely; the next sync/recovery pass can resolve provider state.
  }
  const nextMetadata = { ...metadata, provider_state: providerState };
  const reconnectDueAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const lifecyclePatch = status === "active"
    ? { error_code: null, error_message: null, reconnect_due_at: reconnectDueAt }
    : status === "needs_reauth"
      ? { error_code: "PROVIDER_REAUTH_REQUIRED", error_message: "Le fournisseur Open Banking demande une nouvelle authentification.", reconnect_due_at: null }
      : { error_code: "PROVIDER_STATE_ERROR", error_message: providerState ? `État fournisseur : ${providerState}` : "État fournisseur non disponible.", reconnect_due_at: null };
  const { error: updateError } = await admin.from("bank_connections").update({
    external_connection_id: resolvedConnectionId, status, institution_name: institutionName, consent_expires_at: consentExpiresAt, consent_granted_at: status === "active" ? nowIso : null, reconnect_due_at: lifecyclePatch.reconnect_due_at, last_synced_at: null, error_code: lifecyclePatch.error_code, error_message: lifecyclePatch.error_message, metadata: nextMetadata, updated_at: new Date().toISOString(),
  }).eq("id", match.id).eq("user_id", match.user_id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  redirect.searchParams.set("bank_connected", "1");
  return NextResponse.redirect(redirect);
}
