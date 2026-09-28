import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLiaDecisionPlan, persistLiaDecision, type LiaDecisionPlan } from "@/lib/lia/decision-engine";
import { routeLiaQuestion } from "@/lib/lia/decision-router";

export type LiaDecisionPlanContext = {
  financialContext: boolean;
  budgetContext: boolean;
  forecastContext: boolean;
  task: string;
};

export async function buildAndPersistLiaDecisionPlan(args: {
  supabase: SupabaseClient;
  userId: string;
  objective: string;
  context: LiaDecisionPlanContext;
}): Promise<{ plan: LiaDecisionPlan; decisionRecordId: string }> {
  const plan = await buildLiaDecisionPlan({
    supabase: args.supabase,
    userId: args.userId,
    objective: args.objective,
    financialContext: args.context.financialContext,
    budgetContext: args.context.budgetContext,
    externalInformation: routeLiaQuestion(args.objective, {
      hasAccounts: args.context.financialContext,
      hasTransactions: args.context.financialContext,
      hasBudgets: args.context.budgetContext,
      hasForecasts: args.context.forecastContext,
    }).externalResearch,
  });

  const decisionRecordId = await persistLiaDecision({
    supabase: args.supabase,
    userId: args.userId,
    objective: args.objective,
    plan,
    context: {
      task: args.context.task,
      financial_context: args.context.financialContext,
      budget_context: args.context.budgetContext,
    },
  });

  return { plan, decisionRecordId };
}
