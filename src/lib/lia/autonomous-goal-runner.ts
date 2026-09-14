import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAgentTool } from "@/lib/agent-runtime/executor";
import { AgentHarness } from "@/lib/lia/agent-harness";
import { recordAgentLoopStep, recordEvidence } from "@/lib/agents/loop-engine";
import { advanceGoalLifecycle, persistGoalLifecycle, type LiaGoalLifecycle } from "@/lib/lia/goal-lifecycle";
import { chooseNextReasoningStepV2, type ReasoningMemoryV2 } from "@/lib/lia/reasoning-engine-v2";
import { buildLiaBrainContext, compactBrainContext } from "@/lib/lia/financial-memory/pipeline";
import { acceptLearningRecord } from "@/lib/lia/cognitive-core";
import { verifyReadOnlyObservation, summarizeVerifiedObservation } from "@/lib/lia/autonomy/verifier";

const READ_ONLY_TOOLS = new Set(["get_financial_snapshot", "get_budget_status", "get_cashflow", "get_wealth_snapshot", "get_forecast", "search_transactions"]);
const TASK_TOOLS: Record<string, string[]> = {
  financial_analysis: ["get_financial_snapshot", "get_cashflow", "get_budget_status", "get_forecast", "search_transactions"],
  budget: ["get_budget_status", "get_cashflow", "search_transactions", "get_financial_snapshot"],
  cashflow: ["get_cashflow", "get_financial_snapshot", "get_forecast", "search_transactions"],
  wealth: ["get_wealth_snapshot", "get_financial_snapshot", "get_forecast", "get_cashflow"],
};
export type AutonomousRunResult = { loopRunId: string; status: "completed" | "blocked" | "needs_human" | "failed"; stepsExecuted: number; observations: Array<{ tool: string; ok: boolean }>; nextAction: string; progress: number };
const inferTask = (context: any) => typeof context?.task === "string" ? context.task : "financial_analysis";
const safeToolSet = (task: string) => (TASK_TOOLS[task] ?? TASK_TOOLS.financial_analysis).filter(name => READ_ONLY_TOOLS.has(name));
async function persistWorkingState(supabase: SupabaseClient, loopRunId: string, memory: ReasoningMemoryV2, brain: Record<string, unknown> | null, harnessSummary?: Record<string, unknown>) {
  const { data, error } = await supabase.from("agent_loop_runs").select("context").eq("id", loopRunId).single(); if (error) return;
  await supabase.from("agent_loop_runs").update({ context: { ...(data?.context ?? {}), reasoning_memory: memory, brain_context: brain, harness: harnessSummary ?? null } }).eq("id", loopRunId);
}

/** Persistent bounded agent loop: context -> decide -> act -> verify -> replan -> learn -> memorize. */
export async function runAutonomousGoal(supabase: SupabaseClient, userId: string, loopRunId: string, maxSteps = 8): Promise<AutonomousRunResult> {
  const bounded = Math.max(1, Math.min(8, Math.floor(maxSteps)));
  const { data: run, error } = await supabase.from("agent_loop_runs").select("id,user_id,status,goal,context,decision").eq("id", loopRunId).eq("user_id", userId).single();
  if (error || !run) throw new Error("Objectif LIA introuvable.");
  if (!["running", "blocked", "needs_human"].includes(run.status)) throw new Error("Cet objectif n'est pas exécutable dans son état actuel.");
  const lifecycle = run.context?.goal_lifecycle as LiaGoalLifecycle | undefined;
  if (!lifecycle) throw new Error("État d'objectif absent ou invalide.");
  if (["completed", "failed", "blocked"].includes(lifecycle.state)) return { loopRunId, status: lifecycle.state as AutonomousRunResult["status"], stepsExecuted: 0, observations: [], nextAction: lifecycle.nextAction, progress: lifecycle.progress };
  if (lifecycle.state === "needs_human") return { loopRunId, status: "needs_human", stepsExecuted: 0, observations: [], nextAction: lifecycle.nextAction, progress: lifecycle.progress };

  const task = inferTask(run.context); const tools = safeToolSet(task);
  const brain = await buildLiaBrainContext({ supabase, userId, query: run.goal, loopRunId }); const compactBrain = compactBrainContext(brain) as Record<string, unknown>;
  const previousMemory = run.context?.reasoning_memory as Partial<ReasoningMemoryV2> | undefined;
  const memory: ReasoningMemoryV2 = {
    facts: Array.isArray(previousMemory?.facts) ? previousMemory!.facts.slice(-20) : [], openQuestions: Array.isArray(previousMemory?.openQuestions) ? previousMemory!.openQuestions.slice(-12) : [],
    completedTools: Array.isArray(previousMemory?.completedTools) ? previousMemory!.completedTools.filter((x): x is string => typeof x === "string") : [], failedTools: Array.isArray(previousMemory?.failedTools) ? previousMemory!.failedTools.filter((x): x is string => typeof x === "string") : [],
    checks: Array.isArray(previousMemory?.checks) ? previousMemory!.checks.slice(-20) : [], replans: Number(previousMemory?.replans ?? 0), verifiedObservations: Number(previousMemory?.verifiedObservations ?? 0),
  };
  const observations: Array<{ tool: string; ok: boolean }> = []; const detailed: Array<{ tool: string; ok: boolean; summary?: string }> = [];
  const harness = new AgentHarness({ maxSteps: bounded * 3 + 2, maxToolCalls: bounded, maxWallTimeMs: 120_000, maxRepeatedCalls: 1 });

  let current = advanceGoalLifecycle(lifecycle, "understanding", "charger le contexte durable et identifier les inconnues", { completedStep: "durable_context_loaded" }); await persistGoalLifecycle(supabase, loopRunId, current); await persistWorkingState(supabase, loopRunId, memory, compactBrain, harness.summary());

  for (let i = 0; i < bounded; i++) {
    const modelGuard = harness.guard("model", `model:${i}`); if (!modelGuard.allowed) break;
    const modelStarted = Date.now();
    const remainingSteps = bounded - i;
    const decision = await chooseNextReasoningStepV2({ goal: run.goal, task, allowedTools: tools, memory, observations: detailed, remainingSteps, durableContext: compactBrain });
    harness.record({ kind: "model", name: "reasoning-engine-v2", ok: true, startedAt: new Date(modelStarted).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - modelStarted });
    memory.openQuestions = decision.questions; memory.checks = [...memory.checks, ...decision.checks].slice(-20);
    await recordAgentLoopStep(supabase, loopRunId, 10 + i, { phase: "decide", agentKey: "lia:reasoning-engine-v2", input: { task, allowed_tools: tools, remaining_steps: remainingSteps, memory, durable_context_loaded: true }, output: { action: decision.action, tool: decision.tool, objective: decision.objective, questions: decision.questions, checks: decision.checks, confidence: decision.confidence }, status: "completed" });
    await persistWorkingState(supabase, loopRunId, memory, compactBrain, harness.summary());

    if (decision.action === "needs_human") { current = advanceGoalLifecycle(current, "needs_human", decision.objective || "Une validation humaine est nécessaire.", { completedStep: "reasoning_human_gate" }); await persistGoalLifecycle(supabase, loopRunId, current); harness.complete("blocked", "validation_humaine"); return { loopRunId, status: "needs_human", stepsExecuted: observations.length, observations, nextAction: current.nextAction, progress: current.progress }; }
    if (decision.action === "finish" || !decision.tool) break;
    const tool = decision.tool; const toolGuard = harness.guard("tool", `tool:${tool}`); if (!toolGuard.allowed) { memory.replans += 1; break; }
    current = advanceGoalLifecycle(current, "executing", decision.objective, { completedStep: `reasoning_select:${tool}` }); await persistGoalLifecycle(supabase, loopRunId, current);
    const started = Date.now(); const stepId = await recordAgentLoopStep(supabase, loopRunId, 30 + i, { phase: "act", agentKey: "lia:autonomous-runner", input: { tool, risk: "read", autonomous: true, objective: decision.objective }, output: { pending: true }, status: "completed" });
    try {
      const result = await executeAgentTool(supabase, userId, { name: tool }, { runId: loopRunId, stepId });
      const verification = verifyReadOnlyObservation(result, detailed); const summary = summarizeVerifiedObservation(result); const ok = verification.passed;
      observations.push({ tool, ok }); detailed.push({ tool, ok, summary }); harness.record({ kind: "tool", name: tool, ok, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - started, fingerprint: `tool:${tool}` });
      memory.completedTools.push(tool); memory.facts.push(`${tool}: ${summary.slice(0, 900)}`); memory.verifiedObservations += ok ? 1 : 0; memory.checks.push(...verification.checks.map(c => `${c.key}: ${c.observed ? "ok" : "failed"}`)); if (!ok) memory.replans += 1;
      await recordEvidence(supabase, loopRunId, `tool:${tool}`, "autonomous_observation", { result: typeof result === "object" ? result : { value: result }, verification }, stepId);
      await recordAgentLoopStep(supabase, loopRunId, 40 + i, { phase: "verify", agentKey: "lia:autonomous-verifier", input: { tool, checks: verification.checks }, output: { passed: ok, confidence: verification.confidence }, status: ok ? "completed" : "failed" });
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : "outil indisponible"; observations.push({ tool, ok: false }); detailed.push({ tool, ok: false, summary: message }); memory.failedTools.push(tool); memory.replans += 1; harness.record({ kind: "tool", name: tool, ok: false, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - started, fingerprint: `tool:${tool}`, error: message });
      await recordAgentLoopStep(supabase, loopRunId, 40 + i, { phase: "observe", agentKey: "lia:autonomous-runner", input: { tool }, output: { ok: false, error: message }, status: "failed" });
    }
    current = advanceGoalLifecycle(current, "verifying", "vérifier puis replanifier selon les nouvelles preuves", { completedStep: `verified:${tool}` }); await persistGoalLifecycle(supabase, loopRunId, current); await persistWorkingState(supabase, loopRunId, memory, compactBrain, harness.summary());
  }

  const successCount = observations.filter(x => x.ok).length;
  if (observations.length > 0 && successCount === 0) { current = advanceGoalLifecycle(current, "blocked", "attendre la disponibilité des outils de lecture", { blocker: "Aucune observation déterministe n'a pu être vérifiée." }); await persistGoalLifecycle(supabase, loopRunId, current); harness.complete("blocked", "aucune_observation_verifiee"); return { loopRunId, status: "blocked", stepsExecuted: observations.length, observations, nextAction: current.nextAction, progress: current.progress }; }

  current = advanceGoalLifecycle(current, "learning", "consolider uniquement les observations vérifiées", { completedStep: "learning_from_verified_observations" }); await persistGoalLifecycle(supabase, loopRunId, current);
  try {
    if (successCount >= 2 && memory.verifiedObservations >= 2) await acceptLearningRecord(supabase, userId, { loopRunId, lesson: `La boucle ${task} peut s'appuyer sur des observations déterministes vérifiées avant de conclure.`, context: { task, tools, durable_memory_used: true }, action: { tools_used: observations.map(o => o.tool) }, expectedResult: { at_least_two_verified_observations: true }, actualResult: { verified_observations: memory.verifiedObservations }, validation: { checks: memory.checks.slice(-12), source: "autonomous_verifier" }, confidence: 75, reproducible: true, memoryType: "procedural", topic: `Procédure vérifiée: ${task}` });
  } catch (error) { memory.checks.push(`learning_persistence_failed: ${error instanceof Error ? error.message.slice(0, 180) : "unknown"}`); }

  current = advanceGoalLifecycle(current, "memorizing", "mettre à jour la mémoire gouvernée et préparer la prochaine réévaluation", { completedStep: "memory_consolidation" }); await persistGoalLifecycle(supabase, loopRunId, current); harness.complete("completed"); await persistWorkingState(supabase, loopRunId, memory, compactBrain, harness.summary());
  current = advanceGoalLifecycle(current, "completed", "réévaluer automatiquement si les données ou le contexte changent", { completedStep: "reasoning_completed", result: { observations: successCount, failed_observations: observations.length - successCount, reasoning_steps: detailed.length, replans: memory.replans, verified_observations: memory.verifiedObservations, harness: harness.summary(), recommendation_only: true, autonomous_writes_allowed: false } });
  await persistGoalLifecycle(supabase, loopRunId, current);
  return { loopRunId, status: "completed", stepsExecuted: observations.length, observations, nextAction: current.nextAction, progress: current.progress };
}
