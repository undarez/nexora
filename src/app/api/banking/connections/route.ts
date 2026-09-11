import { NextResponse } from "next/server";
import "@/lib/banking/providers";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { listBankingProviders, getBankingProvider } from "@/lib/banking/provider-registry";

async function auth() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase indisponible.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié.");
  return { supabase, user };
}

async function workspaceAccess(supabase: any, userId: string, workspaceId: string, write = false) {
  const { data, error } = await supabase.from("financial_workspace_members").select("role,status").eq("workspace_id", workspaceId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return !write || ["owner", "admin"].includes(String(data.role));
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await auth();
    const workspaceId = new URL(request.url).searchParams.get("workspaceId")?.trim() || null;
    if (workspaceId && !(await workspaceAccess(supabase, user.id, workspaceId))) return NextResponse.json({ error: "Accès à cet espace financier refusé." }, { status: 403 });
    const query = supabase.from("bank_connections").select("id,provider,status,institution_name,institution_logo_url,last_synced_at,next_sync_at,consent_expires_at,consent_granted_at,reconnect_due_at,error_code,error_message,workspace_id,created_at,updated_at").order("created_at", { ascending: false });
    const { data, error } = workspaceId ? await query.eq("workspace_id", workspaceId) : await query.eq("user_id", user.id).is("workspace_id", null);
    if (error) throw error;
    return NextResponse.json({ readOnlyByDefault: true, rawCredentialsExposed: false, providers: listBankingProviders(), connections: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connexions bancaires indisponibles." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const { supabase, user } = await auth();
    const params = new URL(request.url).searchParams;
    const id = params.get("id")?.trim();
    const workspaceId = params.get("workspaceId")?.trim() || null;
    if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
    const { data: connection, error: lookupError } = await supabase.from("bank_connections").select("id,provider,workspace_id,user_id,status").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!connection) return NextResponse.json({ error: "Connexion bancaire introuvable." }, { status: 404 });
    if (connection.workspace_id) {
      if (!workspaceId || workspaceId !== connection.workspace_id || !(await workspaceAccess(supabase, user.id, String(connection.workspace_id), true))) return NextResponse.json({ error: "Droit de révocation refusé." }, { status: 403 });
    } else if (connection.user_id !== user.id) return NextResponse.json({ error: "Connexion bancaire introuvable." }, { status: 404 });
    if (["revoked", "disconnected"].includes(String(connection.status))) return NextResponse.json({ revoked: true, alreadyRevoked: true });
    const adapter = getBankingProvider(connection.provider);
    if (adapter?.disconnect) await adapter.disconnect({ userId: user.id, connectionId: id });
    const now = new Date().toISOString();
    const accountQuery = supabase.from("bank_accounts").update({ status: "revoked", access_revoked_at: now, updated_at: now }).eq("connection_id", id);
    const { error: accountError } = connection.workspace_id ? await accountQuery.eq("workspace_id", connection.workspace_id) : await accountQuery.eq("user_id", user.id);
    if (accountError) throw accountError;
    const updateQuery = supabase.from("bank_connections").update({ status: "revoked", updated_at: now }).eq("id", id);
    const { error } = connection.workspace_id ? await updateQuery.eq("workspace_id", connection.workspace_id) : await updateQuery.eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Révocation impossible." }, { status: 500 });
  }
}
