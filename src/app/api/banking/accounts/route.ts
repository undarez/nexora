import { NextResponse } from "next/server";
import "@/lib/banking/providers";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getBankingProvider } from "@/lib/banking/provider-registry";

async function auth() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase indisponible.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié.");
  return { supabase, user };
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await auth();
    const connectionId = new URL(request.url).searchParams.get("connectionId");
    if (!connectionId) return NextResponse.json({ error: "connectionId requis." }, { status: 400 });
    const { data: connection, error } = await supabase.from("bank_connections").select("id,provider").eq("id", connectionId).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!connection) return NextResponse.json({ error: "Connexion bancaire introuvable." }, { status: 404 });
    const adapter = getBankingProvider(connection.provider);
    if (!adapter?.listAccounts) return NextResponse.json({ accounts: [], supported: false });
    const accounts = await adapter.listAccounts({ connectionId, userId: user.id });
    return NextResponse.json({ supported: true, accounts: accounts.map((a) => ({
      id: String(a.id ?? ""), name: String(a.name ?? "Compte"), type: String(a.type ?? "other"), currency: String(a.currency ?? "EUR"),
      balance: a.balance == null ? null : Number(a.balance), availableBalance: a.available_balance == null ? (a.balance == null ? null : Number(a.balance)) : Number(a.available_balance),
      disabled: Boolean(a.disabled), ibanMasked: a.iban ? `••••${String(a.iban).slice(-4)}` : null,
    })).filter((a) => a.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Comptes bancaires indisponibles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const { supabase, user } = await auth();
    const body = await request.json().catch(() => ({})) as { connectionId?: string; accountIds?: string[] };
    const connectionId = body.connectionId?.trim();
    const accountIds = Array.isArray(body.accountIds) ? body.accountIds.map(String).filter(Boolean) : [];
    if (!connectionId || !accountIds.length) return NextResponse.json({ error: "connectionId et accountIds requis." }, { status: 400 });
    const { data: connection, error } = await supabase.from("bank_connections").select("id,provider").eq("id", connectionId).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!connection) return NextResponse.json({ error: "Connexion bancaire introuvable." }, { status: 404 });
    const adapter = getBankingProvider(connection.provider);
    if (!adapter?.activateAccounts) return NextResponse.json({ error: "Activation des comptes non supportée par ce fournisseur." }, { status: 422 });
    await adapter.activateAccounts({ connectionId, userId: user.id, externalAccountIds: accountIds });
    return NextResponse.json({ activated: accountIds.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Activation des comptes impossible." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await auth();
    const params = new URL(request.url).searchParams;
    const connectionId = params.get("connectionId")?.trim();
    const accountId = params.get("accountId")?.trim();
    if (!connectionId || !accountId) return NextResponse.json({ error: "connectionId et accountId requis." }, { status: 400 });
    const { data: connection, error: connectionError } = await supabase
      .from("bank_connections").select("id,provider,status").eq("id", connectionId).eq("user_id", user.id).maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return NextResponse.json({ error: "Connexion bancaire introuvable." }, { status: 404 });
    if (["revoked", "disconnected"].includes(String(connection.status))) return NextResponse.json({ error: "Cette connexion bancaire est déjà révoquée." }, { status: 409 });
    const { data: account, error: accountError } = await supabase
      .from("bank_accounts").select("id,external_account_id,status").eq("id", accountId).eq("connection_id", connectionId).eq("user_id", user.id).maybeSingle();
    if (accountError) throw accountError;
    if (!account) return NextResponse.json({ error: "Compte bancaire introuvable." }, { status: 404 });
    const adapter = getBankingProvider(connection.provider);
    if (!adapter?.deactivateAccounts) return NextResponse.json({ error: "Désactivation des comptes non supportée par ce fournisseur." }, { status: 422 });
    await adapter.deactivateAccounts({ connectionId, userId: user.id, externalAccountIds: [String(account.external_account_id)] });
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from("bank_accounts").update({ status: "disabled", access_revoked_at: now, updated_at: now }).eq("id", accountId).eq("connection_id", connectionId).eq("user_id", user.id);
    if (updateError) throw updateError;
    return NextResponse.json({ revoked: true, accountId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Révocation du compte bancaire impossible." }, { status: 500 });
  }
}
