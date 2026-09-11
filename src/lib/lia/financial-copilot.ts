/** V5.08.44 — unified LIA financial copilot projection. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLiaRecommendation, type LiaRecommendation } from "@/lib/lia/recommendation-engine";
import { buildLiaPersonalFinancialModel, compactLiaPersonalFinancialModel } from "@/lib/lia/personal-financial-model";

export type LiaCopilotSnapshot = {
  version: 1;
  generatedAt: string;
  financial: {
    available: boolean;
    balance: number;
    income90d: number;
    expense90d: number;
    transactionCount: number;
    net90d: number;
  };
  planning: {
    budgetAvailable: boolean;
    goalsCount: number;
    forecastCount: number;
  };
  governance: {
    readOnlyContext: true;
    recommendationIsNotAction: true;
    humanApprovalRequired: true;
  };
  recommendation: LiaRecommendation;
  model: ReturnType<typeof compactLiaPersonalFinancialModel>;
};

export async function buildLiaFinancialCopilot(args: {
  supabase: SupabaseClient;
  userId: string;
  objective?: string;
  days?: number;
}): Promise<LiaCopilotSnapshot> {
  const days = Math.max(30, Math.min(args.days ?? 90, 180));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [forecastsResult, model] = await Promise.all([
    args.supabase.from("forecasts").select("id").eq("user_id", args.userId).limit(20),
    buildLiaPersonalFinancialModel({ supabase: args.supabase, userId: args.userId, days }),
  ]);

  if (forecastsResult.error) throw new Error(`copilot_forecasts:${forecastsResult.error.message}`);

  const balance = model.financial.accounts.balance_total;
  const income = model.financial.transactions.income;
  const expense = model.financial.transactions.expenses;
  const budgetAvailable = model.budget.available;
  const transactionCount = model.financial.transactions.count;

  const recommendation = buildLiaRecommendation({
    objective: (args.objective ?? "Faire le point sur ma situation financière").slice(0, 500),
    balance,
    income90d: income,
    expense90d: expense,
    transactionCount,
    hasBudget: budgetAvailable,
    confidenceScore: model.financial.accounts.count > 0 ? 0.85 : 0.6,
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    financial: {
      available: model.financial.transactions.count > 0 || model.financial.accounts.count > 0,
      balance: Number(balance.toFixed(2)),
      income90d: Number(income.toFixed(2)),
      expense90d: Number(expense.toFixed(2)),
      transactionCount,
      net90d: Number((income - expense).toFixed(2)),
    },
    planning: { budgetAvailable, goalsCount: model.goals.length, forecastCount: (forecastsResult.data ?? []).length },
    governance: { readOnlyContext: true, recommendationIsNotAction: true, humanApprovalRequired: true },
    recommendation,
    model: compactLiaPersonalFinancialModel(model),
  };
}
