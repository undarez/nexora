import type { SupabaseClient } from "@supabase/supabase-js";
import { inferEnvelope, observeBudget, observeRecurring, observeTransactions, findOpportunities, predictRecurringExpenses } from "./engine";
import type { BudgetEnvelope, TransactionForAutopilot, FixedExpenseForAutopilot } from "./types";
import { buildFinancialSupervisorContext } from "@/lib/lia/agentic-supervisor";
export { inferEnvelope, observeBudget, observeRecurring, observeTransactions, findOpportunities, predictRecurringExpenses } from "./engine";

export async function runFinancialAutopilotObservation(supabase: SupabaseClient, userId: string, now = new Date()) {
  const [tx, scenario, fixed, accounts] = await Promise.all([
    supabase.from("transactions").select("id,label,amount,occurred_at,category_id").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(500),
    supabase.from("budget_scenarios").select("period_start,envelopes,safety_reserve").eq("user_id", userId).order("period_start", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("fixed_expenses").select("id,label,sector,amount,due_day,recurrence,effective_from,effective_until,is_active,notes").eq("user_id", userId).eq("is_active", true).limit(200),
    supabase.from("accounts").select("balance").eq("user_id", userId).limit(50),
  ]);
  if (tx.error || scenario.error || fixed.error || accounts.error) throw new Error("Contexte financier indisponible pour l'autopilote.");
  const transactions = (tx.data ?? []).map(t => ({ ...t, amount: Number(t.amount) })) as TransactionForAutopilot[];
  const envelopes = (Array.isArray(scenario.data?.envelopes) ? scenario.data.envelopes : []) as BudgetEnvelope[];
  const fixedExpenses = (fixed.data ?? []).map(e => ({ ...e, amount: Number(e.amount) })) as FixedExpenseForAutopilot[];
  const balance = (accounts.data ?? []).reduce((s,a)=>s+Number(a.balance ?? 0),0);
  const reserve = Number(scenario.data?.safety_reserve ?? 0);
  const observations = [...observeTransactions(transactions, envelopes, now), ...observeRecurring(fixedExpenses, now)];
  const opportunities = [...observeBudget(envelopes), ...findOpportunities(fixedExpenses, transactions, balance, reserve, now)];
  const predictions = predictRecurringExpenses(fixedExpenses, now);
  const supervisor = await buildFinancialSupervisorContext({
    supabase, userId, objective: "Surveiller la situation financière, détecter les risques et opportunités et préparer les prochaines étapes sans exécuter de dépense irréversible.", triggerType: "autopilot"
  });
  return { generatedAt: now.toISOString(), observations, opportunities, predictions, supervisor, stats: { transactions: transactions.length, envelopes: envelopes.length, recurringExpenses: fixedExpenses.length, balance, reserve } };
}

export async function autoClassifyHighConfidence(supabase: SupabaseClient, userId: string, now = new Date()) {
  const [tx, scenario] = await Promise.all([
    supabase.from("transactions").select("id,label,amount,occurred_at,category_id").eq("user_id", userId).is("category_id", null).order("occurred_at", { ascending: false }).limit(100),
    supabase.from("budget_scenarios").select("period_start,envelopes").eq("user_id", userId).order("period_start", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (tx.error || scenario.error) throw new Error("Classification automatique indisponible.");
  const envelopes = (Array.isArray(scenario.data?.envelopes) ? scenario.data.envelopes : []) as BudgetEnvelope[];
  const results: Array<Record<string, unknown>> = [];
  for (const transaction of tx.data ?? []) {
    const inferred = inferEnvelope(transaction.label, envelopes);
    if (!inferred || inferred.confidence < 0.9) continue;
    const periodStart = new Date(transaction.occurred_at).toISOString().slice(0,7) + "-01";
    const amount = Math.abs(Number(transaction.amount));
    if (Number(transaction.amount) >= 0 || amount <= 0) continue;
    const { error } = await supabase.from("transaction_envelope_links").upsert({ user_id: userId, transaction_id: transaction.id, period_start: periodStart, envelope_key: inferred.key, amount }, { onConflict: "user_id,transaction_id" });
    if (!error) results.push({ transaction_id: transaction.id, envelope_key: inferred.key, confidence: inferred.confidence, applied_at: now.toISOString() });
  }
  return { applied: results.length, results };
}
