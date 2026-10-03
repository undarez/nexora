import { createHash } from "node:crypto";

export type AgentPrincipal = {
  agentId: string;
  agentKey: "lia";
  userId: string;
  role: "financial_assistant";
  organizationId: string;
};

export function getLiaPrincipal(userId: string): AgentPrincipal {
  const digest = createHash("sha256").update(`gerer-finance:lia:${userId}`).digest("hex").slice(0, 32);
  return { agentId: `lia_${digest}`, agentKey: "lia", userId, role: "financial_assistant", organizationId: `user:${digest}` };
}

export type AgentPolicyDecision = { allowed: true; reason?: string } | { allowed: false; reason: string };

/**
 * Generic server-side execution guard.
 *
 * Per-tool authorization is deliberately not defined here. The authoritative
 * tool policy lives in Supabase's authorize_lia_tool RPC / lia_tool_policies.
 * This layer only protects the invariant that the caller is the expected LIA
 * principal and that the autonomy value is structurally valid.
 */
export function authorizeAgentExecution(principal: AgentPrincipal, autonomyLevel = 1): AgentPolicyDecision {
  if (principal.agentKey !== "lia" || principal.role !== "financial_assistant") {
    return { allowed: false, reason: "agent_identity_denied" };
  }
  if (!Number.isInteger(autonomyLevel) || autonomyLevel < 0 || autonomyLevel > 8) {
    return { allowed: false, reason: "autonomy_level_invalid" };
  }
  return { allowed: true };
}
