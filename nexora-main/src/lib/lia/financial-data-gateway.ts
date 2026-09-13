/**
 * NEXORA Secure Financial Data Gateway v1.
 *
 * The gateway is the only projection layer intended for LIA/model context.
 * Raw account/transaction records remain server-side for deterministic tools.
 * No identifiers, account names, labels, provider references or vault payloads
 * are exposed through this projection.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { governLiaPayload } from "@/lib/lia/data-governance";

type GatewayTransaction = { amount: number; occurred_at: string; category_id?: string | null; categories?: { name?: string | null } | Array<{ name?: string | null }> | null };
type GatewayAccount = { balance: number; currency: string; kind?: string | null };

export type LiaFinancialProjection = {
  security_level: 3;
  raw_data_exposed: false;
  generated_at: string;
  period_days: number;
  accounts: { count: number; balance_total: number; by_currency: Record<string, number>; by_kind: Record<string, number> };
  transactions: {
    count: number;
    income: number;
    expenses: number;
    net: number;
    categories: Array<{ category: string; income: number; expenses: number; count: number }>;
    weekday_distribution: Record<string, number>;
  };
  vault: { present: boolean; item_count: number; raw_payload_available: false };
  invariants: string[];
};

function round(value: number) { return Number(value.toFixed(2)); }
function categoryName(row: GatewayTransaction) {
  const relation = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  return String(relation?.name ?? "non catégorisé").slice(0, 80);
}

export async function buildLiaFinancialProjection(args: { supabase: SupabaseClient; userId: string; days?: number }): Promise<LiaFinancialProjection> {
  const days = Math.min(Math.max(Math.trunc(args.days ?? 90), 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const [accountsResult, transactionsResult, vaultResult] = await Promise.all([
    args.supabase.from("bank_accounts").select("balance,currency,account_type").eq("user_id", args.userId),
    args.supabase.from("bank_transactions").select("amount,booked_at,category").eq("user_id", args.userId).gte("booked_at", since).order("booked_at", { ascending: false }).limit(2000),
    args.supabase.from("financial_secure_vault_items").select("id").eq("user_id", args.userId).eq("status", "active"),
  ]);
  if (accountsResult.error) throw new Error(`financial_accounts_projection:${accountsResult.error.message}`);
  if (transactionsResult.error) throw new Error(`financial_transactions_projection:${transactionsResult.error.message}`);
  if (vaultResult.error && !/relation .*financial_secure_vault_items.*does not exist/i.test(vaultResult.error.message)) {
    throw new Error(`financial_vault_projection:${vaultResult.error.message}`);
  }

  const accounts = (accountsResult.data ?? []) as Array<{ balance: number; currency: string; account_type?: string | null }>;
  const transactions = (transactionsResult.data ?? []) as Array<{ amount: number; booked_at: string; category?: string | null }>;
  const byCurrency: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  for (const account of accounts) {
    const currency = String(account.currency || "EUR").slice(0, 8).toUpperCase();
    byCurrency[currency] = round((byCurrency[currency] ?? 0) + Number(account.balance || 0));
    const kind = String(account.account_type || "other").slice(0, 40);
    byKind[kind] = (byKind[kind] ?? 0) + 1;
  }

  let income = 0, expenses = 0;
  const categories = new Map<string, { income: number; expenses: number; count: number }>();
  const weekdayDistribution: Record<string, number> = {};
  for (const tx of transactions) {
    const amount = Number(tx.amount || 0);
    if (amount > 0) income += amount;
    if (amount < 0) expenses += Math.abs(amount);
    const category = String(tx.category || "non catégorisé").slice(0, 80);
    const current = categories.get(category) ?? { income: 0, expenses: 0, count: 0 };
    current.count += 1;
    if (amount > 0) current.income += amount; else current.expenses += Math.abs(amount);
    categories.set(category, current);
    const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Europe/Paris" }).format(new Date(tx.booked_at));
    weekdayDistribution[weekday] = (weekdayDistribution[weekday] ?? 0) + 1;
  }

  return {
    security_level: 3, raw_data_exposed: false, generated_at: new Date().toISOString(), period_days: days,
    accounts: { count: accounts.length, balance_total: round(accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)), by_currency: byCurrency, by_kind: byKind },
    transactions: { count: transactions.length, income: round(income), expenses: round(expenses), net: round(income - expenses), categories: [...categories.entries()].map(([category, value]) => ({ category, income: round(value.income), expenses: round(value.expenses), count: value.count })).sort((a, b) => b.expenses - a.expenses).slice(0, 30), weekday_distribution: weekdayDistribution },
    vault: { present: (vaultResult.data ?? []).length > 0, item_count: vaultResult.data?.length ?? 0, raw_payload_available: false },
    invariants: ["raw_account_identifiers_never_exposed", "raw_transaction_identifiers_never_exposed", "raw_transaction_labels_never_exposed", "raw_vault_payload_never_exposed", "provider_references_never_exposed", "projection_is_read_only", "projection_grants_no_authority"],
  };
}

export function sanitizeToolResultsForLia(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeToolResultsForLia);
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (["id", "account_id", "user_id", "provider_ref", "label", "name", "ciphertext", "iv", "auth_tag", "source"].includes(key)) continue;
    if (key === "transactions" && Array.isArray(raw)) {
      output.transactions = raw.map((tx) => {
        const t = tx && typeof tx === "object" ? tx as Record<string, unknown> : {};
        return { amount: t.amount, occurred_at: t.occurred_at, category: typeof t.category_id === "string" ? "catégorisé" : "non catégorisé" };
      });
      continue;
    }
    output[key] = sanitizeToolResultsForLia(raw);
  }
  return governLiaPayload(output);
}
