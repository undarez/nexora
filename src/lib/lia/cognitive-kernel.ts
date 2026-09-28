import { routeLiaQuestion } from "@/lib/lia/decision-router";
import { runReasoningKernel } from "@/lib/lia/reasoning-kernel";
import { buildNexoraPlan } from "@/lib/lia/planning-kernel";
import { critiqueNexoraPlan } from "@/lib/lia/critique-kernel";
import { runNexoraDecisionKernel } from "@/lib/lia/decision-kernel";

export function runLiaCognitiveKernel({
  question,
  hasAccounts,
  hasTransactions,
  hasBudgets,
  hasForecasts,
  hasGoals,
}: {
  question: string;
  hasAccounts: boolean;
  hasTransactions: boolean;
  hasBudgets: boolean;
  hasForecasts: boolean;
  hasGoals: boolean;
}) {
  const routing = routeLiaQuestion(question, {
    hasAccounts,
    hasTransactions,
    hasBudgets,
    hasForecasts,
  });

  const reasoning = runReasoningKernel({
    question,
    hasAccounts,
    hasTransactions,
    hasBudgets,
    hasForecasts,
    hasGoals,
    externalResearchRequested: routing.externalResearch,
  });

  const planning = buildNexoraPlan({
    objective: question,
    reasoning,
  });

  const critique = critiqueNexoraPlan({
    reasoning,
    plan: planning,
  });

  const decision = runNexoraDecisionKernel({
    reasoning,
    planning,
    critique,
    externalResearchAvailable: false,
  });

  return { routing, reasoning, planning, critique, decision };
}
