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

const POLICIES: Record<string, { minAutonomy: number; approval: boolean; risk: string }> = {
  get_financial_snapshot: { minAutonomy: 0, approval: false, risk: "read" },
  get_budget_status: { minAutonomy: 0, approval: false, risk: "read" },
  get_cashflow: { minAutonomy: 0, approval: false, risk: "read" },
  get_wealth_snapshot: { minAutonomy: 0, approval: false, risk: "read" },
  get_forecast: { minAutonomy: 0, approval: false, risk: "read" },
  search_transactions: { minAutonomy: 0, approval: false, risk: "read" },
  search_skills: { minAutonomy: 0, approval: false, risk: "read" },
  search_use_cases: { minAutonomy: 0, approval: false, risk: "read" },
  research_web: { minAutonomy: 0, approval: false, risk: "read" },
  learn_use_case: { minAutonomy: 1, approval: false, risk: "recommendation" },
  learn_skill: { minAutonomy: 1, approval: false, risk: "recommendation" },
  save_financial_insight: { minAutonomy: 3, approval: false, risk: "recommendation" },
  create_recommendation: { minAutonomy: 1, approval: false, risk: "recommendation" },
};

/** Server-side policy gate. LLM output is never an authorization decision. */
export function authorizeAgentTool(principal: AgentPrincipal, toolName: string, autonomyLevel = 1): AgentPolicyDecision {
  if (principal.agentKey !== "lia" || principal.role !== "financial_assistant") return { allowed: false, reason: "agent_identity_denied" };
  const policy = POLICIES[toolName];
  if (!policy) return { allowed: false, reason: "tool_policy_missing" };
  if (autonomyLevel < policy.minAutonomy) return { allowed: false, reason: "autonomy_level_insufficient" };
  if (toolName === "create_recommendation" && autonomyLevel < 3) return { allowed: false, reason: "human_approval_required" };
  if (policy.approval) return { allowed: false, reason: "human_approval_required" };
  return { allowed: true };
}

export function getAgentPolicy(toolName: string) { return POLICIES[toolName] ?? null; }
