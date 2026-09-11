import type { SupabaseClient } from "@supabase/supabase-js";
import { getBankingProvider } from "./provider-registry";
import { normalizeAccount, normalizeTransaction } from "./normalize";
import { enforceReconnectDeadline } from "./lifecycle";
import type { NormalizedBankAccount, NormalizedBankTransaction } from "./types";

type SyncResult = {
  synced: boolean;
  provider: string;
  connectionId: string;
  accountsUpserted: number;
  transactionsUpserted: number;
  skipped: number;
  reason?: string;
};

/** Provider-neutral synchronization boundary. Providers remain server-side and fail closed. */
export async function syncBankConnection({
  supabase,
  userId,
  connectionId,
}: {
  supabase: SupabaseClient;
  userId: string;
  connectionId: string;
}): Promise<SyncResult> {
  const { data: connection, error } = await supabase
    .from("bank_connections")
    .select("id,provider,status,workspace_id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!connection) throw new Error("Connexion bancaire introuvable.");
  if (["revoked", "disconnected"].includes(String(connection.status))) {
    return { synced: false, provider: connection.provider, connectionId, accountsUpserted: 0, transactionsUpserted: 0, skipped: 0, reason: "connection_inactive" };
  }

  const { data: lifecycle, error: lifecycleError } = await supabase
    .from("bank_connections")
    .select("status,consent_expires_at,reconnect_due_at")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (lifecycleError) throw lifecycleError;
  const lifecycleGate = await enforceReconnectDeadline({
    supabase,
    userId,
    connectionId,
    status: String(lifecycle?.status ?? connection.status),
    reconnectDueAt: lifecycle?.reconnect_due_at ? String(lifecycle.reconnect_due_at) : null,
    consentExpiresAt: lifecycle?.consent_expires_at ? String(lifecycle.consent_expires_at) : null,
  });
  if (lifecycleGate.blocked) {
    return { synced: false, provider: connection.provider, connectionId, accountsUpserted: 0, transactionsUpserted: 0, skipped: 0, reason: lifecycleGate.reason };
  }

  const adapter = getBankingProvider(connection.provider);
  if (!adapter || !("sync" in adapter) || typeof (adapter as { sync?: unknown }).sync !== "function") {
    return { synced: false, provider: connection.provider, connectionId, accountsUpserted: 0, transactionsUpserted: 0, skipped: 0, reason: "provider_adapter_not_configured" };
  }

  const payload = await (adapter as unknown as {
    sync: (input: { connectionId: string; userId: string }) => Promise<{ accounts: Record<string, unknown>[]; transactions: Record<string, unknown>[] }>;
  }).sync({ connectionId, userId });

  const accounts = payload.accounts.map((item) => normalizeAccount(item, connection.provider)).filter((item) => item.externalAccountId);
  const accountIds = new Map<string, string>();
  for (const account of accounts) {
    const row = {
      user_id: userId,
      workspace_id: connection.workspace_id ?? null,
      connection_id: connectionId,
      provider: account.provider,
      external_account_id: account.externalAccountId,
      name: account.name,
      account_type: account.accountType,
      iban_masked: account.ibanMasked ?? null,
      currency: account.currency,
      balance: Number.isFinite(account.balance ?? NaN) ? account.balance : null,
      available_balance: Number.isFinite(account.availableBalance ?? NaN) ? account.availableBalance : null,
      last_synced_at: new Date().toISOString(),
      metadata: {},
      status: "active",
      access_revoked_at: null,
      updated_at: new Date().toISOString(),
    };
    const { data, error: upsertError } = await supabase.from("bank_accounts").upsert(row, { onConflict: "connection_id,external_account_id" }).select("id,external_account_id").single();
    if (upsertError) throw upsertError;
    accountIds.set(String(data.external_account_id), String(data.id));
    if (account.balance != null && Number.isFinite(account.balance)) {
      const accountId = String(data.id);
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const { data: latestSnapshot, error: snapshotReadError } = await supabase.from("bank_balance_snapshots")
        .select("balance,available_balance,captured_at").eq("account_id", accountId).gte("captured_at", dayStart.toISOString())
        .order("captured_at", { ascending: false }).limit(1).maybeSingle();
      if (snapshotReadError) throw snapshotReadError;
      const changed = !latestSnapshot || Number(latestSnapshot.balance) !== Number(account.balance) || Number(latestSnapshot.available_balance ?? NaN) !== Number(account.availableBalance ?? NaN);
      if (changed) {
        const { error: snapshotError } = await supabase.from("bank_balance_snapshots").insert({
          user_id: userId, account_id: accountId, balance: account.balance, available_balance: account.availableBalance ?? null, currency: account.currency,
        });
        if (snapshotError) throw snapshotError;
      }
    }
  }

  const activeExternalIds = Array.from(accountIds.keys());
  if (activeExternalIds.length) {
    const { error: staleAccountsError } = await supabase
      .from("bank_accounts")
      .update({ status: "disabled", updated_at: new Date().toISOString() })
      .eq("connection_id", connectionId)
      .eq("user_id", userId)
      .eq("status", "active")
      .not("external_account_id", "in", `(${activeExternalIds.map((id) => `"${id.replaceAll('"', '""')}"`).join(",")})`);
    if (staleAccountsError) throw staleAccountsError;
  }

  let transactionsUpserted = 0;
  let skipped = 0;
  for (const item of payload.transactions) {
    const tx = normalizeTransaction(item, connection.provider);
    const accountExternalId = String(item.accountExternalId ?? item.account_id ?? "");
    const accountId = accountIds.get(accountExternalId);
    if (!accountId || !tx.externalTransactionId || !tx.bookedAt) { skipped += 1; continue; }
    const row = {
      user_id: userId,
      workspace_id: connection.workspace_id ?? null,
      account_id: accountId,
      connection_id: connectionId,
      provider: tx.provider,
      external_transaction_id: tx.externalTransactionId,
      booked_at: tx.bookedAt,
      value_date: tx.valueDate ?? null,
      description: tx.description,
      merchant_name: tx.merchantName ?? null,
      amount: tx.amount,
      currency: tx.currency,
      category: tx.category ?? null,
      pending: tx.pending ?? false,
      metadata: {},
      updated_at: new Date().toISOString(),
    };
    const { error: txError } = await supabase.from("bank_transactions").upsert(row, { onConflict: "connection_id,external_transaction_id" });
    if (txError) throw txError;
    transactionsUpserted += 1;
  }

  const now = new Date().toISOString();
  let finalStatus: "active" | "needs_reauth" | "error" = "active";
  let providerState: string | null = null;
  try {
    const stateReader = (adapter as { getConnectionState?: (input: { connectionId: string; userId: string }) => Promise<{ state: string | null }> }).getConnectionState;
    if (stateReader) {
      const state = await stateReader({ connectionId, userId });
      providerState = state.state;
      if (state.state && ["SCARequired", "webauthRequired", "wrongpass", "decoupled"].includes(state.state)) finalStatus = "needs_reauth";
      else if (state.state && state.state !== "ok" && state.state !== "null") finalStatus = "error";
    }
  } catch {
    // Provider reconciliation is best-effort; imported data remains valid.
  }
  const lifecycleUpdate: Record<string, unknown> = { status: finalStatus, last_synced_at: now, updated_at: now };
  if (finalStatus === "active") {
    lifecycleUpdate.error_code = null;
    lifecycleUpdate.error_message = null;
    const currentDue = lifecycle?.reconnect_due_at ? String(lifecycle.reconnect_due_at) : null;
    if (!currentDue) lifecycleUpdate.reconnect_due_at = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  }
  else if (finalStatus === "needs_reauth") { lifecycleUpdate.error_code = "PROVIDER_REAUTH_REQUIRED"; lifecycleUpdate.error_message = "Le fournisseur Open Banking demande une nouvelle authentification."; }
  else { lifecycleUpdate.error_code = "PROVIDER_STATE_ERROR"; lifecycleUpdate.error_message = providerState ? `État fournisseur : ${providerState}` : "État fournisseur non disponible."; }
  await supabase.from("bank_connections").update(lifecycleUpdate).eq("id", connectionId).eq("user_id", userId);
  return { synced: finalStatus === "active", provider: connection.provider, connectionId, accountsUpserted: accounts.length, transactionsUpserted, skipped, reason: finalStatus === "active" ? undefined : finalStatus === "needs_reauth" ? "provider_reauth_required" : "provider_state_error" };
}
