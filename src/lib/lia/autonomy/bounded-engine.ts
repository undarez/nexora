import type { AgentToolDefinition } from "@/lib/agent-runtime/tool-registry";
import { clampAutonomy, type AutonomyLevel } from "@/lib/security/autonomy";

/**
 * Maps the configured autonomy ceiling to capabilities the autonomous runtime
 * may attempt. The Policy Engine remains authoritative and re-checks every tool.
 */
export function autonomousToolSet(
  tools: AgentToolDefinition[],
  autonomyValue: unknown,
): { level: AutonomyLevel; tools: string[]; blocked: Array<{ name: string; reason: string }> } {
  const level = clampAutonomy(autonomyValue, 1);
  const allowed: string[] = [];
  const blocked: Array<{ name: string; reason: string }> = [];

  for (const tool of tools) {
    if (tool.risk === "read") {
      allowed.push(tool.name);
      continue;
    }
    if (tool.requiresUserApproval) {
      blocked.push({ name: tool.name, reason: "human_approval_required" });
      continue;
    }
    if (tool.risk === "recommendation" && level >= 3) {
      allowed.push(tool.name);
      continue;
    }
    blocked.push({
      name: tool.name,
      reason: tool.risk === "recommendation" ? "autonomy_level_requires_L3" : "non_autonomous_risk_class",
    });
  }
  return { level, tools: [...new Set(allowed)], blocked };
}

/**
 * A bounded autonomy profile is a capability ceiling, not an authorization
 * grant. Every selected tool must still pass executeAgentTool's server-side
 * Policy Engine and Decision Gate.
 */
export function describeAutonomy(level: AutonomyLevel) {
  return {
    level,
    automaticRead: true,
    automaticLowRiskExecution: level >= 3,
    automaticChaining: level >= 4,
    strategyChange: level >= 6,
    validatedLearning: level >= 7,
    extendedGoals: level >= 8,
    humanGateForSensitiveActions: true,
    policyEngineRemainsAuthoritative: true,
  };
}
