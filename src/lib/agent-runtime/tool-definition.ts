export type AgentToolRisk = "read" | "recommendation" | "write-sensitive";

export type AgentToolDefinition = {
  name: string;
  description: string;
  risk: AgentToolRisk;
  deterministic: boolean;
  requiresUserApproval: boolean;
};
