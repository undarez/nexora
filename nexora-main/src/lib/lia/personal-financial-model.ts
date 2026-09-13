/** NEXORA Personal Financial Model v1.
 * Unified, read-only context combining the secure projection, goals, budget and behavioural profile.
 * It never exposes raw banking identifiers and never grants authority.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLiaFinancialProjection, type LiaFinancialProjection } from "@/lib/lia/financial-data-gateway";
import { loadFinancialBehaviour } from "@/lib/lia/financial-memory/behaviour";
import { buildUnifiedFinancialContext, type UnifiedFinancialContext } from "@/lib/finance/unified-financial-context";

export type LiaPersonalFinancialModel = {
  version: 1;
  generated_at: string;
  security_level: 3;
  financial: LiaFinancialProjection;
  goals: Array<{ name: string; target_amount: number; current_amount: number; target_date: string | null; priority: number | null }>;
  budget: { available: boolean; scenarios: number; current?: { name?: string | null; income?: number; starting_balance?: number; safety_reserve?: number; extra_expense?: number } | null };
  cross_domain: Pick<UnifiedFinancialContext, "liquidity" | "cashflow" | "budget" | "reconciliation">;
  behaviour: { profile: Record<string, unknown> | null; accepted_habits: Record<string, unknown>[] };
  invariants: string[];
};

export async function buildLiaPersonalFinancialModel(args: { supabase: SupabaseClient; userId: string; days?: number }): Promise<LiaPersonalFinancialModel> {
  const [financial, goalsResult, budgetResult, behaviour, crossDomain] = await Promise.all([
    buildLiaFinancialProjection({ supabase: args.supabase, userId: args.userId, days: args.days ?? 90 }),
    args.supabase.from("goals").select("name,target_amount,current_amount,target_date,priority").eq("user_id", args.userId).order("priority", { ascending: true }).limit(20),
    args.supabase.from("budget_scenarios").select("name,income,starting_balance,safety_reserve,extra_expense").eq("user_id", args.userId).order("period_start", { ascending: false }).limit(1),
    loadFinancialBehaviour(args.supabase, args.userId),
    buildUnifiedFinancialContext({ supabase: args.supabase, userId: args.userId }),
  ]);
  if (goalsResult.error) throw new Error(`personal_model_goals:${goalsResult.error.message}`);
  if (budgetResult.error && !/relation .*budget_scenarios.*does not exist/i.test(budgetResult.error.message)) throw new Error(`personal_model_budget:${budgetResult.error.message}`);

  const goals = (goalsResult.data ?? []).map((g: any) => ({
    name: String(g.name ?? "Objectif").slice(0, 120),
    target_amount: Number(g.target_amount ?? 0),
    current_amount: Number(g.current_amount ?? 0),
    target_date: g.target_date ? String(g.target_date) : null,
    priority: g.priority == null ? null : Number(g.priority),
  }));

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    security_level: 3,
    financial,
    goals,
    budget: { available: !budgetResult.error, scenarios: (budgetResult.data ?? []).length, current: budgetResult.data?.[0] ?? null },
    cross_domain: { liquidity: crossDomain.liquidity, cashflow: crossDomain.cashflow, budget: crossDomain.budget, reconciliation: crossDomain.reconciliation },
    behaviour: { profile: behaviour.profile, accepted_habits: behaviour.habits },
    invariants: [
      "raw_bank_data_never_exposed",
      "raw_account_identifiers_never_exposed",
      "raw_transaction_identifiers_never_exposed",
      "vault_payload_never_exposed",
      "read_only_personal_model",
      "personalization_does_not_grant_authority",
      "knowledge_and_behaviour_do_not_authorize_financial_actions",
      "policy_engine_and_decision_gate_remain_authoritative",
    ],
  };
}

export function compactLiaPersonalFinancialModel(model: LiaPersonalFinancialModel) {
  return {
    version: model.version,
    generated_at: model.generated_at,
    security_level: model.security_level,
    financial: {
      period_days: model.financial.period_days,
      accounts: model.financial.accounts,
      transactions: model.financial.transactions,
      vault: model.financial.vault,
    },
    goals: model.goals,
    budget: model.budget,
    cross_domain: model.cross_domain,
    behaviour: model.behaviour,
    invariants: model.invariants,
  };
}
