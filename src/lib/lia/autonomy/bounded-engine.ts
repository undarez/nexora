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
    const validatedLearningTool = tool.name === "learn_use_case" || tool.name === "learn_skill";
    if (validatedLearningTool && level >= 7) {
      allowed.push(tool.name);
      continue;
    }
    if (tool.risk === "recommendation" && !validatedLearningTool && level >= 3) {
      allowed.push(tool.name);
      continue;
    }
    blocked.push({
      name: tool.name,
      reason: validatedLearningTool ? "validated_learning_requires_L7" : tool.risk === "recommendation" ? `autonomy_level_requires_L${Math.max(3, policy.minAutonomy)}` : "non_autonomous_risk_class",
    });
  }
  return { level, tools: [...new Set(allowed)], blocked };
}

/**
 * A bounded autonomy profile is a capability ceiling, not an authorization
 * grant. Every selected tool must still pass executeAgentTool's server-side
 * Policy Engine and Decision Gate.
 */
export function maxAutonomousToolCalls(level: AutonomyLevel, requested: number) {
  const bounded = Math.max(1, Math.min(8, Math.floor(requested)));
  return level >= 4 ? bounded : 1;
}

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


export type AutonomyStrategy = "observe" | "bounded_execution" | "complex_goal" | "adaptive_replan" | "validated_learning" | "extended_goal";

export function strategyForAutonomy(level: AutonomyLevel): AutonomyStrategy {
  if (level >= 8) return "extended_goal";
  if (level >= 7) return "validated_learning";
  if (level >= 6) return "adaptive_replan";
  if (level >= 5) return "complex_goal";
  if (level >= 3) return "bounded_execution";
  return "observe";
}
