import type { SupabaseClient } from "@supabase/supabase-js";

export const LIA_GOAL_STATES = [
  "objective", "understanding", "decomposing", "researching", "planning",
  "executing", "observing", "verifying", "evaluating", "correcting",
  "learning", "memorizing", "completed", "blocked", "needs_human", "failed",
] as const;
export type LiaGoalState = typeof LIA_GOAL_STATES[number];

export type LiaGoalLifecycle = {
  goalId: string;
  objective: string;
  state: LiaGoalState;
  progress: number;
  completedSteps: string[];
  currentStep: string;
  nextAction: string;
  successCriteria: string[];
  blockers: string[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  result: Record<string, unknown> | null;
};

const STATE_PROGRESS: Record<LiaGoalState, number> = {
  objective: 5, understanding: 12, decomposing: 18, researching: 30, planning: 40,
  executing: 55, observing: 65, verifying: 72, evaluating: 80, correcting: 86,
  learning: 91, memorizing: 95, completed: 100, blocked: 0, needs_human: 0, failed: 0,
};

export function createGoalLifecycle(goalId: string, objective: string, successCriteria: string[] = []): LiaGoalLifecycle {
  const now = new Date().toISOString();
  return { goalId, objective: objective.slice(0, 2000), state: "objective", progress: 5, completedSteps: [], currentStep: "objective", nextAction: "comprendre la demande", successCriteria: successCriteria.slice(0, 8), blockers: [], startedAt: now, updatedAt: now, completedAt: null, result: null };
}

export function advanceGoalLifecycle(current: LiaGoalLifecycle, state: LiaGoalState, nextAction: string, details: { completedStep?: string; blocker?: string; result?: Record<string, unknown> } = {}): LiaGoalLifecycle {
  const completedSteps = details.completedStep && !current.completedSteps.includes(details.completedStep) ? [...current.completedSteps, details.completedStep].slice(-20) : current.completedSteps;
  const blockers = details.blocker && !current.blockers.includes(details.blocker) ? [...current.blockers, details.blocker].slice(-10) : current.blockers;
  const terminal = state === "completed" || state === "failed" || state === "blocked" || state === "needs_human";
  const now = new Date().toISOString();
  return { ...current, state, progress: STATE_PROGRESS[state], currentStep: state, nextAction: nextAction.slice(0, 500), completedSteps, blockers, updatedAt: now, completedAt: terminal ? now : current.completedAt, result: details.result ?? current.result };
}

export async function persistGoalLifecycle(supabase: SupabaseClient, loopRunId: string, lifecycle: LiaGoalLifecycle) {
  const { data: current, error: readError } = await supabase.from("agent_loop_runs").select("context,decision").eq("id", loopRunId).single();
  if (readError) throw new Error(readError.message);
  const context = { ...(current?.context ?? {}), goal_lifecycle: lifecycle };
  const decision = { ...(current?.decision ?? {}), goal_lifecycle: { state: lifecycle.state, progress: lifecycle.progress, next_action: lifecycle.nextAction, blockers: lifecycle.blockers, completed_at: lifecycle.completedAt } };
  const { error } = await supabase.from("agent_loop_runs").update({ context, decision, ...(lifecycle.completedAt ? { completed_at: lifecycle.completedAt } : {}) }).eq("id", loopRunId);
  if (error) throw new Error(error.message);
  return lifecycle;
}

export function lifecycleForResponse(lifecycle: LiaGoalLifecycle) {
  return { goalId: lifecycle.goalId, state: lifecycle.state, progress: lifecycle.progress, currentStep: lifecycle.currentStep, nextAction: lifecycle.nextAction, completedSteps: lifecycle.completedSteps, blockers: lifecycle.blockers, completedAt: lifecycle.completedAt };
}
