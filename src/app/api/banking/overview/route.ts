import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import "@/lib/banking/providers";
import { syncBankConnection } from "@/lib/banking/sync-engine";

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    // Toujours demander une synchronisation fraîche avant de calculer le solde affiché.
    const { data: activeConnections, error: connectionSyncLookupError } = await supabase
      .from("bank_connections")
      .select("id,status")
      .eq("user_id", user.id)
      .not("status", "in", "(revoked,disconnected)");
    if (connectionSyncLookupError) throw connectionSyncLookupError;
    for (const connection of activeConnections ?? []) {
      try {
        await syncBankConnection({ supabase, userId: user.id, connectionId: String(connection.id) });
      } catch {
        // Une panne fournisseur ne doit pas masquer les dernières données valides déjà stockées.
      }
    }

    const [accountsResult, transactionsResult, connectionsResult] = await Promise.all([
      supabase.from("bank_accounts").select("id,connection_id,name,account_type,iban_masked,currency,balance,available_balance,last_synced_at,provider").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("bank_transactions").select("id,account_id,booked_at,value_date,description,merchant_name,amount,currency,category,pending").eq("user_id", user.id).order("booked_at", { ascending: false }).order("created_at", { ascending: false }).limit(50),
      supabase.from("bank_connections").select("id,provider,status,institution_name,institution_logo_url,last_synced_at,consent_expires_at").eq("user_id", user.id),
    ]);
    if (accountsResult.error) throw accountsResult.error;
    if (transactionsResult.error) throw transactionsResult.error;
    if (connectionsResult.error) throw connectionsResult.error;

    const accounts = accountsResult.data ?? [];
    const transactions = transactionsResult.data ?? [];
    const byCurrency: Record<string, number> = {};
    for (const account of accounts) {
      const currency = String(account.currency || "EUR").toUpperCase();
      byCurrency[currency] = Number((byCurrency[currency] ?? 0) + Number(account.balance ?? 0));
    }
    const totals = Object.fromEntries(Object.entries(byCurrency).map(([currency, value]) => [currency, Number(value.toFixed(2))]));
    const eurTransactions = transactions.filter(t => String(t.currency || "EUR").toUpperCase() === "EUR");
    const expense30 = eurTransactions.filter(t => Number(t.amount) < 0).reduce((sum,t)=>sum+Math.abs(Number(t.amount)),0);
    const income30 = eurTransactions.filter(t => Number(t.amount) > 0).reduce((sum,t)=>sum+Number(t.amount),0);
    const availableByCurrency: Record<string, number> = {};
    for (const account of accounts) {
      const currency = String(account.currency || "EUR").toUpperCase();
      if (account.available_balance != null) availableByCurrency[currency] = Number((availableByCurrency[currency] ?? 0) + Number(account.available_balance));
    }
    const accountCountByType: Record<string, number> = {};
    for (const account of accounts) {
      const kind = String(account.account_type || "other");
      accountCountByType[kind] = (accountCountByType[kind] ?? 0) + 1;
    }

    return NextResponse.json({ accounts, transactions, connections: connectionsResult.data ?? [], totalsByCurrency: totals, recentFlow: { income: Number(income30.toFixed(2)), expenses: Number(expense30.toFixed(2)), net: Number((income30-expense30).toFixed(2)), currency: "EUR" }, availableByCurrency, accountCountByType, rawCredentialsExposed: false, rawProviderPayloadExposed: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vue financière indisponible." }, { status: 500 });
  }
}
