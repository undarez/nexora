import type { SupabaseClient } from "@supabase/supabase-js";

export type LoopTrigger = "user_request" | "scheduled" | "proactive" | "goal" | "retry" | "cron" | "curator" | "stop";
export type LoopPhase = "observe" | "context" | "plan" | "act" | "verify" | "decide" | "learn";

type StepInput = { phase: LoopPhase; agentKey?: string; input?: Record<string, unknown>; output?: Record<string, unknown>; status?: string; durationMs?: number };

/**
 * Durable control loop: deterministic code records the lifecycle; the LLM does
 * not decide whether a financial operation is allowed to execute.
 */
export async function startAgentLoop(supabase: SupabaseClient, userId: string, goal: string, triggerType: LoopTrigger, context: Record<string, unknown> = {}) {
  const { data, error } = await supabase.from("agent_loop_runs").insert({ user_id: userId, trigger_type: triggerType, goal: goal.slice(0, 2000), context }).select("id").single();
  if (error || !data) throw new Error(error?.message || "Impossible de créer la boucle agentique.");
  return data.id as string;
}

export async function recordAgentLoopStep(supabase: SupabaseClient, loopRunId: string, stepOrder: number, step: StepInput) {
  const payload = { loop_run_id: loopRunId, step_order: stepOrder, phase: step.phase, agent_key: step.agentKey ?? null, status: step.status ?? "completed", input: step.input ?? {}, output: step.output ?? {}, duration_ms: step.durationMs ?? null };
  const { data, error } = await supabase.from("agent_loop_steps").insert(payload).select("id").single();
  if (!error && data) return data.id as string;
  // The loop can legitimately be observed twice (React retries, duplicate
  // client submissions, or concurrent orchestration branches). The database
  // deliberately enforces one row per (run, order), so treat a duplicate as
  // idempotent instead of failing the whole cognitive loop.
  if (error?.code === "23505" || /agent_loop_steps_loop_run_id_step_order_key/i.test(error?.message ?? "")) {
    const existing = await supabase.from("agent_loop_steps").select("id").eq("loop_run_id", loopRunId).eq("step_order", stepOrder).maybeSingle();
    if (existing.data?.id) return existing.data.id as string;
  }
  throw new Error(error?.message || "Impossible d'enregistrer l'étape agentique.");
}

export async function recordEvidence(supabase: SupabaseClient, loopRunId: string, source: string, evidenceType: string, payload: Record<string, unknown>, stepId?: string) {
  const { error } = await supabase.from("agent_evidence").insert({ loop_run_id: loopRunId, step_id: stepId ?? null, source, evidence_type: evidenceType, payload });
  if (error) throw new Error(error.message);
}

export async function finishAgentLoop(supabase: SupabaseClient, loopRunId: string, status: "completed" | "failed" | "blocked" | "needs_human", decision: Record<string, unknown>) {
  const { error } = await supabase.from("agent_loop_runs").update({ status, decision, completed_at: new Date().toISOString() }).eq("id", loopRunId);
  if (error) throw new Error(error.message);
}
