export type PreActionDisposition = "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "SANDBOX_ONLY";

export type PreActionAssessment = {
  disposition: PreActionDisposition;
  intent: string;
  target: string;
  data: string;
  purpose: string;
  risk: "low" | "medium" | "high";
  capability: string;
  reversible: boolean;
  reasons: string[];
};

/**
 * Deterministic pre-action behavioral monitor.
 * It is an additional safety boundary, never an authorization grant.
 */
export function assessPreAction(input: {
  tool: string;
  description: string;
  risk: "read" | "recommendation" | "write-sensitive";
  requiresUserApproval: boolean;
  deterministic: boolean;
}): PreActionAssessment {
  const reasons: string[] = [];
  const reversible = input.risk !== "write-sensitive";
  const risk = input.risk === "write-sensitive" ? "high" : input.risk === "recommendation" ? "medium" : "low";

  if (!input.tool.trim()) return {
    disposition: "DENY",
    intent: "unknown",
    target: "unknown",
    data: "unknown",
    purpose: "unknown",
    risk: "high",
    capability: "unknown",
    reversible: false,
    reasons: ["missing_tool"],
  };

  if (input.risk === "write-sensitive") {
    reasons.push("write_sensitive");
    return {
      disposition: "REQUIRE_APPROVAL",
      intent: input.description,
      target: input.tool,
      data: "user-scoped application data",
      purpose: input.description,
      risk,
      capability: input.tool,
      reversible,
      reasons,
    };
  }

  if (input.risk === "recommendation" && input.requiresUserApproval) {
    reasons.push("approval_required_by_tool");
    return {
      disposition: "REQUIRE_APPROVAL",
      intent: input.description,
      target: input.tool,
      data: "user-scoped application data",
      purpose: input.description,
      risk,
      capability: input.tool,
      reversible,
      reasons,
    };
  }

  return {
    disposition: "ALLOW",
    intent: input.description,
    target: input.tool,
    data: "user-scoped application data",
    purpose: input.description,
    risk,
    capability: input.tool,
    reversible,
    reasons,
  };
}
