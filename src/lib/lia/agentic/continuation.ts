import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistAgentContinuation(args: { supabase: SupabaseClient; userId: string; loopRunId: string; goal: string; task: string; state: Record<string, unknown>; nextCheckAt?: string | null }) {
  const { data, error } = await args.supabase.rpc("lia_upsert_agent_continuation", { p_user_id: args.userId, p_loop_run_id: args.loopRunId, p_goal: args.goal, p_task: args.task, p_state: args.state, p_next_check_at: args.nextCheckAt ?? null });
  if (error) throw new Error(`Continuation agentique indisponible : ${error.message}`);
  return String(data);
}

export async function claimAgentContinuations(supabase: SupabaseClient, limit = 10) {
  const { data, error } = await supabase.rpc("lia_claim_agent_continuations", { p_limit: Math.min(50, Math.max(1, limit)) });
  if (error) throw new Error(`Claim continuation indisponible : ${error.message}`);
  return data ?? [];
}

export async function finishAgentContinuation(supabase: SupabaseClient, id: string, status: "completed" | "blocked" | "cancelled" | "waiting", state: Record<string, unknown>, errorMessage?: string) {
  const { data, error } = await supabase.rpc("lia_finish_agent_continuation", { p_id: id, p_status: status, p_state: state, p_error: errorMessage ?? null });
  if (error) throw new Error(`Finalisation continuation indisponible : ${error.message}`);
  return Boolean(data);
}
