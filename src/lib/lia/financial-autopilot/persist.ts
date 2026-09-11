import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutopilotOpportunity } from "./types";
import type { runFinancialAutopilotObservation } from "./index";

export async function persistAutopilotSnapshot(supabase: SupabaseClient, userId: string, snapshot: Awaited<ReturnType<typeof runFinancialAutopilotObservation>>) {
  if (snapshot.predictions.length) {
    const { error } = await supabase.from("lia_financial_predictions").upsert(snapshot.predictions.map(p => ({ user_id: userId, prediction_key: `recurring:${p.fixedExpenseId}:${p.dueDate}`, prediction_type: "recurring_expense", label: p.label, amount: p.amount, due_date: p.dueDate, confidence: 0.97, evidence: p, status: "active" })), { onConflict: "user_id,prediction_key" });
    if (error) throw new Error(`prediction_persist_failed:${error.message}`);
  }
  if (snapshot.opportunities.length) {
    const { error } = await supabase.from("lia_financial_opportunities").upsert(snapshot.opportunities.map((o: AutopilotOpportunity) => ({ user_id: userId, opportunity_key: o.key, opportunity_type: o.type, severity: o.severity, title: o.title, message: o.message, estimated_impact: o.estimatedImpact, confidence: o.confidence, reversible: o.reversible, requires_human_approval: o.requiresHumanApproval, evidence: o.evidence, status: "open" })), { onConflict: "user_id,opportunity_key" });
    if (error) throw new Error(`opportunity_persist_failed:${error.message}`);
  }
  return { predictions: snapshot.predictions.length, opportunities: snapshot.opportunities.length };
}
