import { NextResponse } from "next/server";
import "@/lib/banking/providers";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { syncBankConnection } from "@/lib/banking/sync-engine";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    const body = await request.json().catch(() => ({})) as { connectionId?: string };
    if (!body.connectionId) return NextResponse.json({ error: "connectionId requis." }, { status: 400 });

    const { data: connection } = await supabase.from("bank_connections").select("id,provider").eq("id", body.connectionId).eq("user_id", user.id).maybeSingle();
    if (!connection) return NextResponse.json({ error: "Connexion bancaire introuvable." }, { status: 404 });

    const start = new Date().toISOString();
    const { data: run, error: runError } = await supabase.from("bank_sync_runs").insert({ user_id: user.id, connection_id: connection.id, provider: connection.provider, status: "started", started_at: start }).select("id").single();
    if (runError) throw runError;

    try {
      const result = await syncBankConnection({ supabase, userId: user.id, connectionId: connection.id });
      const finalStatus = result.synced ? "completed" : "skipped";
      await supabase.from("bank_sync_runs").update({ status: finalStatus, accounts_upserted: result.accountsUpserted, transactions_upserted: result.transactionsUpserted, skipped_count: result.skipped, reason: result.reason ?? null, completed_at: new Date().toISOString() }).eq("id", run.id);
      return NextResponse.json({ ...result, rawCredentialsExposed: false, rawProviderPayloadExposed: false }, { status: result.synced ? 200 : 503 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Synchronisation bancaire impossible.";
      await supabase.from("bank_sync_runs").update({ status: "failed", error_message: message, completed_at: new Date().toISOString() }).eq("id", run.id);
      await supabase.from("bank_connections").update({ status: "error", error_code: "SYNC_FAILED", error_message: message, updated_at: new Date().toISOString() }).eq("id", connection.id).eq("user_id", user.id);
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Synchronisation bancaire impossible.", synced: false, rawCredentialsExposed: false }, { status: 500 });
  }
}
