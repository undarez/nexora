import type { LiaSkillPermission } from "./types";
import { registerExecutableLiaSkill } from "@/lib/lia/agent/skill-runtime";

export type FinanceTransaction = {
  amount: number;
  category?: string | null;
  date?: string | null;
  type?: "income" | "expense" | "transfer" | string;
};

export type FinanceAnalyticsInput = {
  transactions: readonly FinanceTransaction[];
  category?: string;
};

export type FinanceAnalyticsOutput = {
  transactionCount: number;
  income: number;
  expenses: number;
  net: number;
  byCategory: Record<string, number>;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateFinanceAnalytics(input: FinanceAnalyticsInput): FinanceAnalyticsOutput {
  const selected = input.category
    ? input.transactions.filter(transaction => transaction.category?.toLowerCase() === input.category?.toLowerCase())
    : input.transactions;

  let income = 0;
  let expenses = 0;
  const byCategory: Record<string, number> = {};

  for (const transaction of selected) {
    if (!Number.isFinite(transaction.amount)) continue;
    const amount = Math.abs(transaction.amount);
    if (transaction.type === "income") income += amount;
    else if (transaction.type === "expense") expenses += amount;
    else if (transaction.amount < 0) expenses += amount;
    else income += amount;

    const category = transaction.category?.trim() || "Non catégorisé";
    byCategory[category] = roundMoney((byCategory[category] ?? 0) + amount);
  }

  return {
    transactionCount: selected.length,
    income: roundMoney(income),
    expenses: roundMoney(expenses),
    net: roundMoney(income - expenses),
    byCategory,
  };
}

registerExecutableLiaSkill<FinanceAnalyticsInput, FinanceAnalyticsOutput>({
  id: "finance.analytics",
  name: "Analyse financière",
  description: "Calcule les revenus, dépenses, solde net et dépenses par catégorie à partir de transactions déjà autorisées.",
  capabilities: ["spending_analysis", "income_analysis", "category_breakdown"],
  requiredPermissions: ["finance.read"] as readonly LiaSkillPermission[],
  riskClass: "read",
  execute: async input => calculateFinanceAnalytics(input),
  verify: async output => ({
    ok: output.income >= 0 && output.expenses >= 0 && Number.isFinite(output.net),
    reason: "Les agrégats financiers doivent être finis et non négatifs pour revenus/dépenses.",
  }),
});
