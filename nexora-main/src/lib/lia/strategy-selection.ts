import type { StrategyExperience } from "./strategy-learning";
import type { ConsolidatedStrategyMemory } from "./strategy-consolidation";
import { contextualStrategyScore, type StrategyContext } from "./contextual-strategy-memory.ts";

export type StrategyCandidate = {
  strategyKey: string;
  score: number;
  confidence: number;
  sampleSize: number;
  explored: boolean;
  reason: string;
};

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic exploration: bounded, reproducible, and never outside the supplied allow-list. */
export function selectStrategyV2(args: {
  allowed: string[];
  experiences: StrategyExperience[];
  memories?: ConsolidatedStrategyMemory[];
  context: StrategyContext;
  contextKey: string;
  explorationRate?: number;
}): { selected: string; candidates: StrategyCandidate[] } {
  const allowed = [...new Set(args.allowed)].filter(Boolean);
  if (!allowed.length) return { selected: "stop", candidates: [] };
  const memories = new Map((args.memories ?? []).map(m => [m.strategyKey, m]));
  const candidates = allowed.map((strategyKey, index) => {
    const relevant = args.experiences.filter(e => e.strategyKey === strategyKey);
    const contextual = relevant.length
      ? relevant.slice(0, 100).reduce((sum, e) => sum + contextualStrategyScore(e, args.context), 0) / relevant.length
      : 0;
    const memory = memories.get(strategyKey);
    const memoryScore = memory ? memory.decayedScore : 0;
    const confidence = memory?.confidence ?? 0;
    const sampleSize = memory?.sampleSize ?? relevant.length;
    // Historical/contextual evidence dominates; confidence modestly stabilizes selection.
    const score = relevant.length || memory
      ? contextual * 0.65 + memoryScore * 0.35 + confidence * 10
      : 0;
    return { strategyKey, score, confidence, sampleSize, explored: false, reason: relevant.length || memory ? "Historique et mémoire contextuelle." : "Aucune expérience suffisante." };
  });

  candidates.sort((a, b) => b.score - a.score || b.confidence - a.confidence || b.sampleSize - a.sampleSize || a.strategyKey.localeCompare(b.strategyKey));
  const best = candidates[0];
  const unknown = candidates.filter(c => c.sampleSize === 0);
  const rate = Math.max(0, Math.min(0.2, args.explorationRate ?? 0.10));
  const seed = stableHash(`${args.contextKey}|${args.experiences.length}|${args.memories?.length ?? 0}`) / 0xffffffff;

  // Explore only when evidence is weak or alternatives are close. Never bypass allow-list.
  const second = candidates[1];
  const close = second && Math.abs(best.score - second.score) <= 12;
  if ((unknown.length > 0 && seed < rate) || (close && seed < rate / 2)) {
    const pool = unknown.length ? unknown : candidates.slice(1);
    const picked = pool[stableHash(`${args.contextKey}|explore`) % pool.length];
    if (picked) {
      picked.explored = true;
      picked.reason = unknown.length ? "Exploration contrôlée faute d'expérience suffisante." : "Exploration contrôlée entre stratégies proches.";
      return { selected: picked.strategyKey, candidates };
    }
  }
  best.reason = best.reason || "Meilleur score disponible dans l'allow-list.";
  return { selected: best.strategyKey, candidates };
}
