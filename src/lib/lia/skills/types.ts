export type LiaRiskClass = "read" | "write" | "critical";

export type LiaPermission =
  | "finance.read"
  | "finance.write"
  | "banking.read"
  | "banking.write"
  | "web.search"
  | "memory.read"
  | "memory.write"
  | "content.read"
  | "content.write"
  | "seo.read"
  | "system.read"
  | "system.write"
  | "data.read"
  | "data.write"
  | "mobility.read"
  | "research.read";

export type LiaSkillContext = {
  userId: string;
  requestId?: string;
  locale?: string;
  permissions?: readonly LiaPermission[];
};

export type LiaSkillDefinition<TInput = unknown, TOutput = unknown> = {
  id: string;
  name: string;
  description: string;
  capabilities: readonly string[];
  requiredPermissions: readonly LiaPermission[];
  riskClass: LiaRiskClass;
  inputSchema: Record<string, unknown>;
  execute: (input: TInput, context: LiaSkillContext) => Promise<TOutput>;
  verify?: (output: TOutput, context: LiaSkillContext) => Promise<{ ok: boolean; reason?: string }>;
};
