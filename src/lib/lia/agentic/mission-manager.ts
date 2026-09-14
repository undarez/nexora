import type { SupabaseClient } from "@supabase/supabase-js";
import { runAgenticOrchestration } from "@/lib/lia/agentic/orchestrator";

type Mission = { id: string; user_id: string; parent_id: string | null; loop_run_id: string | null; goal: string; task: string; priority: number; state: Record<string, unknown>; attempts: number };

export async function enqueueAgentMission(args: { supabase: SupabaseClient; userId: string; goal: string; task?: string; priority?: number; parentId?: string | null; dependsOn?: string[]; state?: Record<string, unknown>; nextRunAt?: string | null }) {
  const { data, error } = await args.supabase.rpc("lia_enqueue_agent_mission", {
    p_user_id: args.userId, p_goal: args.goal, p_task: args.task ?? "financial_analysis", p_priority: args.priority ?? 50,
    p_parent_id: args.parentId ?? null, p_depends_on: args.dependsOn ?? [], p_state: args.state ?? {}, p_next_run_at: args.nextRunAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Mission agentique indisponible : ${error.message}`);
  return String(data);
}

export async function claimAgentMissions(supabase: SupabaseClient, limit = 5): Promise<Mission[]> {
  const { data, error } = await supabase.rpc("lia_claim_agent_missions", { p_limit: Math.min(20, Math.max(1, limit)) });
  if (error) throw new Error(`Claim missions indisponible : ${error.message}`);
  return (data ?? []) as Mission[];
}

export async function updateAgentMission(supabase: SupabaseClient, id: string, status: "queued" | "running" | "paused" | "waiting" | "completed" | "blocked" | "cancelled", state: Record<string, unknown>, errorMessage?: string, nextRunAt?: string | null, loopRunId?: string | null) {
  const { data, error } = await supabase.rpc("lia_update_agent_mission", { p_id: id, p_status: status, p_state: state, p_error: errorMessage ?? null, p_next_run_at: nextRunAt ?? null, p_loop_run_id: loopRunId ?? null });
  if (error) throw new Error(`Mise à jour mission indisponible : ${error.message}`);
  return Boolean(data);
}

export async function runClaimedMission(args: { supabase: SupabaseClient; mission: Mission; loopRunId: string }) {
  const result = await runAgenticOrchestration({ supabase: args.supabase, userId: args.mission.user_id, loopRunId: args.loopRunId, goal: args.mission.goal, task: args.mission.task, maxSteps: 8 });
  const state = { ...args.mission.state, last_run: new Date().toISOString(), result: { status: result.status, observations: result.observations, memory: result.memory, harness: result.harness } };
  const status = result.status === "completed" ? "completed" : "waiting";
  await updateAgentMission(args.supabase, args.mission.id, status, state, result.harness?.reason, status === "waiting" ? new Date(Date.now() + 30 * 60_000).toISOString() : null, args.loopRunId);
  return result;
}
