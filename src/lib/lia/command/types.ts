export type LiaCommandDomain = "finance" | "mobility" | "system" | "research" | "productivity" | "copywriting" | "seo" | "data" | "conversation" | "unknown";

export type LiaCommandIntent =
  | "finance.budget.read" | "finance.budget.allocate" | "finance.transactions.read" | "finance.spending.analyze" | "finance.goal.read"
  | "mobility.fuel.read" | "mobility.trip.cost" | "mobility.vehicle.read"
  | "research.search" | "research.learn" | "system.health_check" | "system.diagnostics"
  | "data.quality_check" | "data.deduplicate" | "copywriting.generate" | "seo.audit" | "productivity.task.create" | "unknown";

export type LiaCommandRisk = "low" | "medium" | "high" | "critical";
export type LiaCommandMode = "read" | "analyze" | "suggest" | "write" | "execute" | "critical";
export type LiaCommandParameters = Record<string, string | number | boolean | null>;

export type LiaIntentResult = {
  intent: LiaCommandIntent; domain: LiaCommandDomain; confidence: number;
  parameters: LiaCommandParameters; missing: string[]; reason: string;
};
export type LiaCommandPolicy = {
  mode: LiaCommandMode; risk: LiaCommandRisk; requiresConfirmation: boolean;
  allowedAutomatically: boolean; reason: string;
};
export type LiaCommandRoute = { agent: string; skill: string; toolFamily: string };
export type LiaCommandPlan = { input: string; intent: LiaIntentResult; policy: LiaCommandPolicy; route: LiaCommandRoute };
