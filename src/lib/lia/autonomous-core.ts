import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLiaMemory, rememberLiaEpisode } from "@/lib/lia/memory-core";

export type LiaWakeReason = "schedule" | "event" | "goal" | "research" | "recovery" | "manual";
export type LiaCoreState = "sleeping" | "waking" | "thinking" | "acting" | "learning" | "waiting" | "blocked";

export type LiaAutonomousState = {
  state: LiaCoreState;
  reason: LiaWakeReason;
  lastWakeAt: string | null;
  nextWakeAt: string | null;
  activeGoalId: string | null;
  memoryLoaded: boolean;
  safety: { aiEnabled: boolean; webEnabled: boolean; bankingEnabled: boolean; autonomyEnabled: boolean };
};

const MAX_GOAL = 1600;

/**
 * Durable wake preparation. This is intentionally a coordinator, not a self-granting
 * authority: permissions remain outside the core in the Policy/Tool Gateway.
 */
export async function prepareLiaWake(args: {
  supabase: SupabaseClient;
  userId: string;
  reason: LiaWakeReason;
  goal?: string;
}) {
  const goal = String(args.goal ?? "").slice(0, MAX_GOAL);
  const memory = await loadLiaMemory(args.supabase, args.userId, goal);
  const { data: controls } = await args.supabase.from("lia_runtime_controls").select("ai_enabled,web_research_enabled,banking_refresh_enabled,cron_autonomy_enabled").eq("id", 1).maybeSingle();
  const safety = {
    aiEnabled: controls?.ai_enabled !== false,
    webEnabled: controls?.web_research_enabled !== false,
    bankingEnabled: controls?.banking_refresh_enabled !== false,
    autonomyEnabled: controls?.cron_autonomy_enabled !== false,
  };
  return {
    state: safety.aiEnabled && safety.autonomyEnabled ? "waking" as const : "blocked" as const,
    reason: args.reason,
    lastWakeAt: new Date().toISOString(),
    nextWakeAt: null,
    activeGoalId: null,
    memoryLoaded: true,
    safety,
    memory,
  } satisfies LiaAutonomousState & { memory: typeof memory };
}

/** Record a bounded autonomous episode so a future wake can recall what happened. */
export async function recordLiaWakeEpisode(args: {
  supabase: SupabaseClient;
  userId: string;
  reason: LiaWakeReason;
  summary: string;
  loopRunId?: string | null;
}) {
  return rememberLiaEpisode({
    supabase: args.supabase,
    userId: args.userId,
    topic: `LIA wake · ${args.reason}`,
    summary: args.summary,
    loopRunId: args.loopRunId,
    reliability: 75,
  });
}
