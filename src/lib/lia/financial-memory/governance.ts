import { createClient as createAdminClient } from "@supabase/supabase-js";

export type DecisionGateOutcome = "ALLOW" | "ALLOW_WITH_GUARDRAIL" | "REQUIRE_APPROVAL" | "ESCALATE" | "BLOCK";

export async function recordDecisionGate(args: {
  runId?: string | null;
  stepId?: string | null;
  actionType: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  reversible?: boolean;
  authorizationPresent: boolean;
  policyId?: string | null;
  amount?: number | null;
  currency?: string | null;
  knowledgeIds?: string[];
  evidenceIds?: string[];
  rationale?: Record<string, unknown>;
}): Promise<{ id: string; outcome: DecisionGateOutcome } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.rpc("record_agent_decision_gate", {
    p_run_id: args.runId ?? null,
    p_step_id: args.stepId ?? null,
    p_action_type: args.actionType,
    p_risk_level: args.riskLevel,
    p_reversible: args.reversible ?? true,
    p_authorization_present: args.authorizationPresent,
    p_policy_id: args.policyId ?? null,
    p_amount: args.amount ?? null,
    p_currency: args.currency ?? "EUR",
    p_knowledge_ids: args.knowledgeIds ?? [],
    p_evidence_ids: args.evidenceIds ?? [],
    p_rationale: args.rationale ?? {},
  });
  if (error || !data?.[0]) return null;
  return { id: String(data[0].id), outcome: data[0].outcome as DecisionGateOutcome };
}
