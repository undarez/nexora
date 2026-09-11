import type { StrategyExperience } from "@/lib/lia/strategy-learning";

export type ConsolidatedStrategyMemory = {
  strategyKey: string;
  sampleSize: number;
  decayedScore: number;
  successRate: number;
  consistency: number;
  confidence: number;
  contradiction: boolean;
  lastObservedAt?: string;
};

const HALF_LIFE_DAYS = 30;

function decay(ageDays: number) {
  return Math.pow(0.5, Math.max(0, ageDays) / HALF_LIFE_DAYS);
}

export function consolidateStrategyExperiences(experiences: Array<StrategyExperience & { createdAt?: string }>): ConsolidatedStrategyMemory[] {
  const now = Date.now();
  const groups = new Map<string, typeof experiences>();
  for (const e of experiences.slice(0, 200)) {
    const list = groups.get(e.strategyKey) ?? [];
    list.push(e);
    groups.set(e.strategyKey, list);
  }
  return [...groups.entries()].map(([strategyKey, list]) => {
    let weightTotal = 0;
    let scoreTotal = 0;
    let successes = 0;
    let positive = 0;
    let negative = 0;
    let lastObservedAt: string | undefined;
    for (const e of list) {
      const t = e.createdAt ? Date.parse(e.createdAt) : now;
      const ageDays = Number.isFinite(t) ? Math.max(0, (now - t) / 86400000) : 0;
      const w = decay(ageDays);
      weightTotal += w;
      scoreTotal += e.score * w;
      if (e.outcome === "success") successes += w;
      if (e.score >= 50) positive += 1;
      if (e.score <= -50) negative += 1;
      if (!lastObservedAt || (e.createdAt && e.createdAt > lastObservedAt)) lastObservedAt = e.createdAt;
    }
    const decayedScore = weightTotal ? Math.round(scoreTotal / weightTotal) : 0;
    const successRate = weightTotal ? Number((successes / weightTotal).toFixed(3)) : 0;
    const consistency = list.length ? Number((1 - Math.min(1, Math.abs(list.reduce((a, e) => a + e.score, 0) / list.length - decayedScore) / 200)).toFixed(3)) : 0;
    const contradiction = positive > 0 && negative > 0;
    const sampleFactor = Math.min(1, Math.log2(list.length + 1) / 3);
    const confidence = Number((Math.max(0, Math.min(1, sampleFactor * (0.5 * consistency + 0.5 * (contradiction ? 0.35 : 1))))).toFixed(3));
    return { strategyKey, sampleSize: list.length, decayedScore, successRate, consistency, confidence, contradiction, lastObservedAt };
  }).sort((a,b) => b.confidence - a.confidence || b.decayedScore - a.decayedScore || b.sampleSize - a.sampleSize);
}

export async function loadConsolidatedStrategyMemory(args: { supabase: any; userId: string; goalKey: string; limit?: number }): Promise<ConsolidatedStrategyMemory[]> {
  const { data, error } = await args.supabase.from("lia_strategy_memory").select("strategy_key,sample_size,decayed_score,success_rate,consistency,confidence,contradiction,last_observed_at").eq("user_id", args.userId).eq("goal_key", args.goalKey).order("confidence", { ascending: false }).limit(Math.min(50, Math.max(1, args.limit ?? 20)));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ strategyKey: String(r.strategy_key), sampleSize: Number(r.sample_size), decayedScore: Number(r.decayed_score), successRate: Number(r.success_rate), consistency: Number(r.consistency), confidence: Number(r.confidence), contradiction: Boolean(r.contradiction), lastObservedAt: r.last_observed_at ?? undefined }));
}

export async function persistConsolidatedStrategyMemory(args: { supabase: any; userId: string; goalKey: string; memories: ConsolidatedStrategyMemory[] }) {
  if (!args.memories.length) return;
  const rows = args.memories.slice(0, 50).map(m => ({ user_id: args.userId, goal_key: args.goalKey.slice(0, 160), strategy_key: m.strategyKey.slice(0, 120), sample_size: m.sampleSize, decayed_score: m.decayedScore, success_rate: m.successRate, consistency: m.consistency, confidence: m.confidence, contradiction: m.contradiction, last_observed_at: m.lastObservedAt ?? null }));
  const { error } = await args.supabase.from("lia_strategy_memory").upsert(rows, { onConflict: "user_id,goal_key,strategy_key" });
  if (error) throw new Error(error.message);
}
