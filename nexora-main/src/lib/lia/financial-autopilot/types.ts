export type AutopilotSeverity = "info" | "warning" | "danger";
export type AutopilotOpportunityType = "budget_drift" | "recurring_expense" | "contract_review" | "subscription_review" | "cashflow_risk" | "savings_capacity";

export type BudgetEnvelope = { id: string; name?: string; planned?: number; spent?: number; manual_spent?: number; [key: string]: unknown };
export type TransactionForAutopilot = { id: string; label: string; amount: number; occurred_at: string; category_id?: string | null };
export type FixedExpenseForAutopilot = { id: string; label: string; sector: string; amount: number; due_day?: number | null; recurrence: string; effective_from: string; effective_until?: string | null; is_active: boolean; notes?: string | null };

export type AutopilotObservation = {
  key: string;
  type: "transaction_classification" | "recurring" | "budget" | "cashflow" | "contract";
  severity: AutopilotSeverity;
  title: string;
  message: string;
  confidence: number;
  actionHref: string;
  evidence: Record<string, unknown>;
};

export type AutopilotOpportunity = {
  key: string;
  type: AutopilotOpportunityType;
  severity: AutopilotSeverity;
  title: string;
  message: string;
  estimatedImpact: number | null;
  confidence: number;
  reversible: boolean;
  requiresHumanApproval: boolean;
  evidence: Record<string, unknown>;
};
