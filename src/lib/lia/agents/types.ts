export type LiaSpecialistId =
  | "copywriting"
  | "seo"
  | "system-admin"
  | "data"
  | "finance"
  | "mobility"
  | "research";

export type LiaAgentPermission =
  | "content.read"
  | "content.write"
  | "seo.read"
  | "system.read"
  | "system.write"
  | "data.read"
  | "data.write"
  | "finance.read"
  | "finance.write"
  | "mobility.read"
  | "research.read";

export type LiaAgentDefinition = {
  id: LiaSpecialistId;
  label: string;
  purpose: string;
  skills: string[];
  permissions: LiaAgentPermission[];
  maxSteps: number;
  maxRetriesPerStep: number;
  autonomyLevel: number;
  requiresHumanApprovalFor: Array<"write" | "critical">;
  verifyRequired: boolean;
};

export type LiaAgentExecutionStatus =
  | "planned"
  | "waiting_confirmation"
  | "running"
  | "completed"
  | "failed";

export type LiaAgentStep = {
  id: string;
  agentId: LiaSpecialistId;
  skillId: string;
  purpose: string;
  status: LiaAgentExecutionStatus;
  requiresConfirmation: boolean;
  verificationRequired: boolean;
};

export type LiaAgentRunResult = {
  status: LiaAgentExecutionStatus;
  agent: LiaAgentDefinition;
  steps: LiaAgentStep[];
  output: Record<string, unknown>;
  verification: { required: boolean; passed: boolean | null; reason: string };
};
