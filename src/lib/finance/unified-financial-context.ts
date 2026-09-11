import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveTransactionIntelligence, type FinancialFact } from "./transaction-intelligence";

export type UnifiedFinancialContext = {
  version: 4;
  generated_at: string;
  period_start: string;
  period_end: string;
  liquidity: {
    connected_bank: number;
    manual_accounts: number;
    total_by_currency: Record<string, number>;
    available_by_currency: Record<string, number>;
    primary_currency: string;
    primary_total: number;
    connected_accounts: number;
    manual_accounts_count: number;
  };
  cashflow: {
    income: number;
    expenses: number;
    net: number;
    transaction_count: number;
    bank_transaction_count: number;
    manual_transaction_count: number;
  };
  budget: {
    available: boolean;
    planned: number;
    spent: number;
    remaining: number;
    income_planned: number;
    starting_balance: number;
    safety_reserve: number;
    extra_expense: number;
    fixed_commitments: number;
    variable_remaining: number;
    projected_end: number;
    margin_to_reserve: number;
    envelope_count: number;
    weeks_remaining: number;
    envelopes: Array<{ id: string; name: string; planned: number; spent: number }>;
    fixed_items: Array<{ id: string; label: string; sector: string; amount: number; recurrence: string }>;
  };
  categories: Array<{ category: string; amount: number; count: number }>;
  goals: Array<{ name: string; target_amount: number; current_amount: number; target_date: string | null; priority: number }>;
  connections: Array<{ provider: string; status: string; institution_name: string | null; last_synced_at: string | null; consent_expires_at: string | null }>;
  intelligence: {
    recurring: Array<{ key: string; label: string; amount: number; cadence: string; occurrences: number; confidence: number; nextExpectedDate: string | null }>;
    anomalies: Array<{ id: string; label: string; amount: number; category: string; baseline: number; ratio: number; confidence: number; occurredAt: string }>;
  };
    reconciliation: {
    bank_ledger_present: boolean;
    manual_ledger_present: boolean;
    budget_links_manual: number;
    budget_links_bank: number;
  };
};

const round = (n: number) => Number(n.toFixed(2));

function monthRange(periodStart?: string) {
  const start = /^\d{4}-\d{2}-01$/.test(periodStart ?? "") ? periodStart! : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const end = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

/**
 * Single read-only cross-domain projection for dashboard, budget, transactions,
 * banking, forecasts and LIA. It deliberately keeps connected-bank and manual
 * ledgers separate to prevent accidental double counting.
 */
export async function buildUnifiedFinancialContext({
  supabase,
  userId,
  periodStart,
}: {
  supabase: SupabaseClient;
  userId: string;
  periodStart?: string;
}): Promise<UnifiedFinancialContext> {
  const { start, end } = monthRange(periodStart);
  const historyStartDate = new Date(`${start}T12:00:00Z`);
  historyStartDate.setUTCDate(historyStartDate.getUTCDate() - 180);
  const historyStart = historyStartDate.toISOString().slice(0, 10);

  const [
    bankAccountsResult,
    manualAccountsResult,
    bankTxResult,
    manualTxResult,
    budgetResult,
    fixedResult,
    goalsResult,
    connectionsResult,
    manualLinksResult,
    bankLinksResult,
  ] = await Promise.all([
    supabase.from("bank_accounts").select("balance,available_balance,currency").eq("user_id", userId),
    supabase.from("accounts").select("balance,currency").eq("user_id", userId),
    supabase.from("bank_transactions").select("id,amount,currency,category,description,merchant_name,booked_at").eq("user_id", userId).gte("booked_at", historyStart).lt("booked_at", end).order("booked_at", { ascending: false }).limit(5000),
    supabase.from("transactions").select("id,amount,occurred_at,label,category_id,categories(name)").eq("user_id", userId).gte("occurred_at", `${historyStart}T00:00:00Z`).lt("occurred_at", `${end}T00:00:00Z`).order("occurred_at", { ascending: false }).limit(5000),
    supabase.from("budget_scenarios").select("income,starting_balance,safety_reserve,extra_expense,weeks_remaining,envelopes").eq("user_id", userId).eq("period_start", start).maybeSingle(),
    supabase.from("fixed_expenses").select("amount,recurrence,effective_from,effective_until,is_active").eq("user_id", userId),
    supabase.from("goals").select("name,target_amount,current_amount,target_date,priority").eq("user_id", userId).order("priority", { ascending: true }).limit(20),
    supabase.from("bank_connections").select("provider,status,institution_name,last_synced_at,consent_expires_at").eq("user_id", userId),
    supabase.from("transaction_envelope_links").select("amount").eq("user_id", userId).eq("period_start", start),
    supabase.from("bank_transaction_envelope_links").select("amount").eq("user_id", userId).eq("period_start", start),
  ]);

  const results = [bankAccountsResult, manualAccountsResult, bankTxResult, manualTxResult, budgetResult, fixedResult, goalsResult, connectionsResult, manualLinksResult, bankLinksResult];
  const hardError = results.find((r) => r.error && !/(relation .*bank_(accounts|transactions|connections|transaction_envelope_links).*does not exist|Could not find the table .*bank_transaction_envelope_links.*schema cache)/i.test(r.error.message));
  if (hardError?.error) throw new Error(`unified_financial_context:${hardError.error.message}`);

  const bankAccounts = bankAccountsResult.data ?? [];
  const manualAccounts = manualAccountsResult.data ?? [];
  const allBankTx = bankTxResult.data ?? [];
  const allManualTx = manualTxResult.data ?? [];
  const bankTx = allBankTx.filter((tx: any) => String(tx.booked_at) >= start && String(tx.booked_at) < end);
  const manualTx = allManualTx.filter((tx: any) => String(tx.occurred_at).slice(0, 10) >= start && String(tx.occurred_at).slice(0, 10) < end);

  const intelligenceFacts: FinancialFact[] = [
    ...allBankTx.map((tx: any) => ({ id: `bank:${tx.id}`, label: String(tx.merchant_name || tx.description || "Opération bancaire"), amount: Number(tx.amount || 0), occurredAt: String(tx.booked_at), category: tx.category ? String(tx.category) : null, source: "bank" as const })),
    ...allManualTx.map((tx: any) => { const rel = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories; return { id: `manual:${tx.id}`, label: String(tx.label || "Transaction"), amount: Number(tx.amount || 0), occurredAt: String(tx.occurred_at).slice(0, 10), category: rel?.name ? String(rel.name) : null, source: "manual" as const }; }),
  ];
  const intelligence = deriveTransactionIntelligence(intelligenceFacts);

  const totalByCurrency: Record<string, number> = {};
  const availableByCurrency: Record<string, number> = {};
  for (const a of [...bankAccounts, ...manualAccounts]) {
    const c = String(a.currency || "EUR").toUpperCase();
    totalByCurrency[c] = round((totalByCurrency[c] ?? 0) + Number(a.balance || 0));
  }
  for (const a of bankAccounts) {
    const c = String(a.currency || "EUR").toUpperCase();
    availableByCurrency[c] = round((availableByCurrency[c] ?? 0) + Number(a.available_balance ?? a.balance ?? 0));
  }
  const primaryCurrency = totalByCurrency.EUR != null ? "EUR" : (Object.keys(totalByCurrency)[0] ?? "EUR");

  let income = 0, expenses = 0;
  const categoryMap = new Map<string, { amount: number; count: number }>();
  const addTx = (amountRaw: unknown, category: string) => {
    const amount = Number(amountRaw || 0);
    if (amount > 0) income += amount;
    if (amount < 0) expenses += Math.abs(amount);
    if (amount < 0) {
      const current = categoryMap.get(category) ?? { amount: 0, count: 0 };
      current.amount += Math.abs(amount);
      current.count += 1;
      categoryMap.set(category, current);
    }
  };

  for (const tx of bankTx) addTx(tx.amount, String(tx.category || "Non catégorisé"));
  for (const row of manualTx) {
    const rel = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    addTx(row.amount, String(rel?.name || "Non catégorisé"));
  }

  const scenario = budgetResult.data;
  const envelopes = Array.isArray(scenario?.envelopes) ? scenario.envelopes : [];
  const planned = envelopes.reduce((s: number, e: any) => s + Math.max(Number(e?.planned || 0), 0), 0);
  const spentFromBudget = envelopes.reduce((s: number, e: any) => s + Math.max(Number(e?.spent || 0), 0), 0);
  const fixedCommitments = (fixedResult.data ?? []).filter((e: any) => {
    if (!e.is_active) return false;
    const ym = start.slice(0, 7);
    if (e.recurrence === "one_off") return String(e.effective_from).slice(0, 7) === ym;
    return String(e.effective_from).slice(0, 7) <= ym && (!e.effective_until || String(e.effective_until).slice(0, 7) >= ym);
  }).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const incomePlanned = Number(scenario?.income ?? 0);
  const startingBalance = Number(scenario?.starting_balance ?? 0);
  const safetyReserve = Number(scenario?.safety_reserve ?? 0);
  const extraExpense = Number(scenario?.extra_expense ?? 0);
  const remaining = Math.max(planned - spentFromBudget, 0);
  // End-of-month projection follows the plan, not the unspent remainder:
  // subtracting only `remaining` would make a higher observed spend improve
  // the projection.
  const projectedEnd = startingBalance + incomePlanned - fixedCommitments - planned - extraExpense;
  const fixedItems = (fixedResult.data ?? []).filter((e: any) => {
    if (!e.is_active) return false;
    const ym = start.slice(0, 7);
    if (e.recurrence === "one_off") return String(e.effective_from).slice(0, 7) === ym;
    return String(e.effective_from).slice(0, 7) <= ym && (!e.effective_until || String(e.effective_until).slice(0, 7) >= ym);
  }).map((e: any) => ({
    id: String(e.id ?? ""), label: String(e.label ?? "Charge fixe"), sector: String(e.sector ?? ""),
    amount: round(Number(e.amount || 0)), recurrence: String(e.recurrence ?? "monthly"),
  })).sort((a, b) => b.amount - a.amount).slice(0, 20);
  const contextEnvelopes = envelopes.map((e: any) => ({
    id: String(e?.id ?? ""), name: String(e?.name ?? "Enveloppe"),
    planned: round(Math.max(Number(e?.planned || 0), 0)), spent: round(Math.max(Number(e?.spent || 0), 0)),
  }));

  return {
    version: 4,
    generated_at: new Date().toISOString(),
    period_start: start,
    period_end: end,
    liquidity: {
      connected_bank: round(bankAccounts.reduce((s, a) => s + Number(a.balance || 0), 0)),
      manual_accounts: round(manualAccounts.reduce((s, a) => s + Number(a.balance || 0), 0)),
      total_by_currency: totalByCurrency,
      available_by_currency: availableByCurrency,
      primary_currency: primaryCurrency,
      primary_total: round(totalByCurrency[primaryCurrency] ?? 0),
      connected_accounts: bankAccounts.length,
      manual_accounts_count: manualAccounts.length,
    },
    cashflow: {
      income: round(income),
      expenses: round(expenses),
      net: round(income - expenses),
      transaction_count: bankTx.length + manualTx.length,
      bank_transaction_count: bankTx.length,
      manual_transaction_count: manualTx.length,
    },
    budget: {
      available: Boolean(scenario),
      planned: round(planned),
      spent: round(spentFromBudget),
      remaining: round(remaining),
      income_planned: round(incomePlanned),
      starting_balance: round(startingBalance),
      safety_reserve: round(safetyReserve),
      extra_expense: round(extraExpense),
      fixed_commitments: round(fixedCommitments),
      variable_remaining: round(remaining),
      projected_end: round(projectedEnd),
      margin_to_reserve: round(projectedEnd - safetyReserve),
      envelope_count: envelopes.length,
      weeks_remaining: Math.max(Number(scenario?.weeks_remaining ?? 4), 1),
      envelopes: contextEnvelopes,
      fixed_items: fixedItems,
    },
    categories: [...categoryMap.entries()].map(([category, value]) => ({ category, amount: round(value.amount), count: value.count })).sort((a, b) => b.amount - a.amount).slice(0, 20),
    intelligence: {
      recurring: intelligence.recurring,
      anomalies: intelligence.anomalies,
    },
    goals: (goalsResult.data ?? []).map((g: any) => ({
      name: String(g.name ?? "Objectif").slice(0, 120),
      target_amount: Number(g.target_amount ?? 0),
      current_amount: Number(g.current_amount ?? 0),
      target_date: g.target_date ? String(g.target_date) : null,
      priority: Number(g.priority ?? 50),
    })),
    connections: (connectionsResult.data ?? []).map((c: any) => ({
      provider: String(c.provider),
      status: String(c.status),
      institution_name: c.institution_name ? String(c.institution_name) : null,
      last_synced_at: c.last_synced_at ? String(c.last_synced_at) : null,
      consent_expires_at: c.consent_expires_at ? String(c.consent_expires_at) : null,
    })),
      reconciliation: {
      bank_ledger_present: bankAccounts.length > 0 || bankTx.length > 0,
      manual_ledger_present: manualAccounts.length > 0 || manualTx.length > 0,
      budget_links_manual: round((manualLinksResult.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0)),
      budget_links_bank: round((bankLinksResult.data ?? []).reduce((s, x) => s + Number(x.amount || 0), 0)),
    },
  };
}
