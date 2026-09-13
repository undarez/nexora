import type { StrategyExperience } from "@/lib/lia/strategy-learning";

export type StrategyContext = {
  objectiveType?: string;
  research?: boolean;
  budget?: boolean;
  finance?: boolean;
  relational?: boolean;
  action?: boolean;
  autonomyLevel?: number;
  maxAutonomyLevel?: number;
  tone?: string;
  detailLevel?: string;
  initiativeLevel?: number;
};

function normalize(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim().toLowerCase().slice(0, 80);
  return undefined;
}

export function buildStrategyContextKey(context: StrategyContext): string {
  const parts = [
    context.objectiveType,
    context.research ? "research" : "no-research",
    context.budget ? "budget" : "no-budget",
    context.finance ? "finance" : "no-finance",
    context.relational ? "relational" : "no-relational",
    context.action ? "action" : "no-action",
    typeof context.autonomyLevel === "number" ? `a${context.autonomyLevel}` : undefined,
    typeof context.maxAutonomyLevel === "number" ? `m${context.maxAutonomyLevel}` : undefined,
    context.tone,
    context.detailLevel,
    typeof context.initiativeLevel === "number" ? `i${context.initiativeLevel}` : undefined,
  ].filter(Boolean).map(String);
  return parts.join("|").slice(0, 240);
}

export function contextualStrategyScore(experience: StrategyExperience, context: StrategyContext): number {
  const stored = (experience.context ?? {}) as StrategyContext;
  let similarity = 0;
  const dimensions: Array<keyof StrategyContext> = [
    "objectiveType", "research", "budget", "finance", "relational", "action",
    "autonomyLevel", "maxAutonomyLevel", "tone", "detailLevel", "initiativeLevel",
  ];
  for (const key of dimensions) {
    const current = normalize(context[key]);
    const previous = normalize(stored[key]);
    if (current === undefined || previous === undefined) continue;
    if (current === previous) similarity += key === "objectiveType" ? 4 : 1;
    else if ((key === "autonomyLevel" || key === "maxAutonomyLevel" || key === "initiativeLevel") && typeof current === "number" && typeof previous === "number" && Math.abs(current - previous) <= 1) similarity += 0.5;
  }
  return experience.score + similarity * 10;
}

/** Chooses among an explicit allow-list using historical outcomes weighted by contextual similarity. */
export function chooseContextualStrategy(experiences: StrategyExperience[], allowed: string[], context: StrategyContext): string {
  const candidates = allowed.map(strategyKey => {
    const matching = experiences.filter(e => e.strategyKey === strategyKey);
    if (!matching.length) return { strategyKey, score: 0, sampleSize: 0 };
    const weighted = matching.slice(0, 100).map(e => contextualStrategyScore(e, context));
    return { strategyKey, score: weighted.reduce((a, b) => a + b, 0) / weighted.length, sampleSize: matching.length };
  });
  return candidates.sort((a, b) => b.score - a.score || b.sampleSize - a.sampleSize)[0]?.strategyKey ?? allowed[0] ?? "stop";
}
