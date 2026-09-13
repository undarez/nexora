import type { BudgetEnvelope, Forecast, RiskLevel, Transaction } from '@/lib/finance-types';

export const PRUDENT_INCOME = 1730;
export const TARGET_END_BALANCE_MIN = 100;
export const TARGET_END_BALANCE_MAX = 150;
export const SAFETY_BUFFER = 100;

export function totalExpenses(transactions: Transaction[]) { return transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0); }
export function totalIncome(transactions: Transaction[]) { return transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0); }
export function budgetRemaining(envelopes: BudgetEnvelope[]) { return envelopes.reduce((sum, e) => sum + Math.max(0, e.planned - e.spent), 0); }
export function riskLevel(projectedBalance: number): RiskLevel { if (projectedBalance < 0) return 'high'; if (projectedBalance < SAFETY_BUFFER) return 'medium'; return 'low'; }
export function cashflow(currentBalance: number, income: number, commitments: number, variable: number) { return currentBalance + income - commitments - variable; }
export function makeForecast(currentBalance: number, remainingIncome: number, remainingCommitments: number, variableBudget: number): Forecast[] {
  const base = cashflow(currentBalance, remainingIncome, remainingCommitments, 0);
  return [
    { scenario: 'favorable', endBalance: base - variableBudget * 0.75, assumptions: ['Dépenses variables réduites de 25 %', 'Aucun imprévu majeur'] },
    { scenario: 'central', endBalance: base - variableBudget, assumptions: ['Budget variable respecté', 'Dépenses connues intégrées'] },
    { scenario: 'defavorable', endBalance: base - variableBudget * 1.25 - 100, assumptions: ['Dépenses variables +25 %', 'Réserve imprévu de 100 € consommée'] },
  ];
}
