import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAgentTool } from "@/lib/agent-runtime/executor";
import { recordAgentLoopStep, recordEvidence } from "@/lib/agents/loop-engine";
import { advanceGoalLifecycle, persistGoalLifecycle, type LiaGoalLifecycle } from "@/lib/lia/goal-lifecycle";
import { AgentHarness } from "@/lib/lia/agent-harness";

const READ_ONLY_TOOLS = new Set([
  "get_financial_snapshot",
  "get_budget_status",
  "get_cashflow",
  "get_wealth_snapshot",
  "get_forecast",
  "search_transactions",
]);

const TASK_TOOLS: Record<string, string[]> = {
  financial_analysis: ["get_financial_snapshot", "get_cashflow", "get_budget_status"],
  budget: ["get_budget_status", "get_cashflow", "search_transactions"],
  cashflow: ["get_cashflow", "get_financial_snapshot", "get_forecast"],
  wealth: ["get_wealth_snapshot", "get_financial_snapshot", "get_forecast"],
};

export type AutonomousRunResult = {
  loopRunId: string;
  status: "completed" | "blocked" | "needs_human" | "failed";
  stepsExecuted: number;
  observations: Array<{ tool: string; ok: boolean }>;
  nextAction: string;
  progress: number;
  harness: ReturnType<AgentHarness["summary"]>;
};

function inferTask(context: any): string {
  return typeof context?.task === "string" ? context.task : "financial_analysis";
}

function safeToolSet(task: string): string[] {
  return (TASK_TOOLS[task] ?? TASK_TOOLS.financial_analysis).filter((name) => READ_ONLY_TOOLS.has(name));
}

/**
 * Bounded autonomous runner. It can only observe/read and advance a goal.
 * It deliberately cannot execute write-sensitive or critical financial tools.
 * One HTTP call = one bounded run, preventing runaway agent loops.
 */
export async function runAutonomousGoal(
  supabase: SupabaseClient,
  userId: string,
  loopRunId: string,
  maxSteps = 3,
): Promise<AutonomousRunResult> {
  const bounded = Math.max(1, Math.min(5, Math.floor(maxSteps)));
  const harness = new AgentHarness({
    maxSteps: bounded + 2,
    maxToolCalls: bounded,
    maxWallTimeMs: Math.min(120_000, bounded * 30_000),
    maxRepeatedCalls: 1,
  });
  const { data: run, error } = await supabase.from("agent_loop_runs")
    .select("id,user_id,status,goal,context,decision")
    .eq("id", loopRunId).eq("user_id", userId).single();
  if (error || !run) throw new Error("Objectif LIA introuvable.");
  if (!["running", "blocked", "needs_human"].includes(run.status)) throw new Error("Cet objectif n'est pas exécutable dans son état actuel.");

  const lifecycle = run.context?.goal_lifecycle as LiaGoalLifecycle | undefined;
  if (!lifecycle) throw new Error("État d'objectif absent ou invalide.");
  if (["completed", "failed", "blocked"].includes(lifecycle.state)) {
    return { loopRunId, status: lifecycle.state as any, stepsExecuted: 0, observations: [], nextAction: lifecycle.nextAction, progress: lifecycle.progress, harness: harness.summary() };
  }
  if (lifecycle.state === "needs_human") {
    return { loopRunId, status: "needs_human", stepsExecuted: 0, observations: [], nextAction: lifecycle.nextAction, progress: lifecycle.progress, harness: harness.summary() };
  }

  const task = inferTask(run.context);
  const tools = safeToolSet(task).slice(0, bounded);
  const observations: Array<{ tool: string; ok: boolean }> = [];
  let current = advanceGoalLifecycle(lifecycle, "executing", "observer les données autorisées", { completedStep: "autonomous_start" });
  await persistGoalLifecycle(supabase, loopRunId, current);

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const startedAt = Date.now();
    const guard = harness.guard("tool", `${tool}:default`);
    if (!guard.allowed) {
      observations.push({ tool, ok: false });
      break;
    }
    try {
      const result = await executeAgentTool(supabase, userId, { name: tool });
      observations.push({ tool, ok: true });
      harness.record({
        kind: "tool",
        name: tool,
        ok: true,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        fingerprint: `${tool}:default`,
      });
      await recordAgentLoopStep(supabase, loopRunId, 30 + i, {
        phase: "act", agentKey: "lia:autonomous-runner",
        input: { tool, risk: "read", autonomous: true },
        output: { ok: true, result: typeof result === "object" ? result as Record<string, unknown> : { value: result } },
        status: "completed",
      });
      if (result && typeof result === "object" && !Array.isArray(result)) {
        await recordEvidence(supabase, loopRunId, `tool:${tool}`, "autonomous_observation", result as Record<string, unknown>);
      }
    } catch (err) {
      observations.push({ tool, ok: false });
      harness.record({
        kind: "tool",
        name: tool,
        ok: false,
        startedAt: new Date(startedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        fingerprint: `${tool}:default`,
        error: err instanceof Error ? err.message.slice(0, 500) : "outil indisponible",
      });
      await recordAgentLoopStep(supabase, loopRunId, 30 + i, {
        phase: "observe", agentKey: "lia:autonomous-runner",
        input: { tool, risk: "read", autonomous: true },
        output: { ok: false, error: err instanceof Error ? err.message.slice(0, 500) : "outil indisponible" },
        status: "failed",
      });
    }
  }

  const successCount = observations.filter((x) => x.ok).length;
  const allSucceeded = observations.length > 0 && successCount === observations.length;
  const noToolSucceeded = observations.length > 0 && successCount === 0;

  if (noToolSucceeded) {
    current = advanceGoalLifecycle(current, "blocked", "attendre la disponibilité des outils de lecture", { blocker: "Aucune observation déterministe n'a pu être obtenue." });
    await persistGoalLifecycle(supabase, loopRunId, current);
    harness.complete("blocked", "Aucune observation déterministe n'a pu être obtenue.");
    return { loopRunId, status: "blocked", stepsExecuted: observations.length, observations, nextAction: current.nextAction, progress: current.progress, harness: harness.summary() };
  }

  current = advanceGoalLifecycle(current, "verifying", allSucceeded ? "vérifier les observations et déterminer la prochaine étape" : "vérifier les observations disponibles malgré les outils indisponibles", { completedStep: "autonomous_observation" });
  await persistGoalLifecycle(supabase, loopRunId, current);
  await recordAgentLoopStep(supabase, loopRunId, 40, {
    phase: "verify", agentKey: "lia:autonomous-runner",
    input: { observation_count: observations.length },
    output: { successful: successCount, failed: observations.length - successCount, human_authority_required: true },
    status: "completed",
  });

  // The runner stops before any financial mutation. A later iteration can continue from this state.
  current = advanceGoalLifecycle(current, "evaluating", "évaluer les observations et préparer la prochaine action", { completedStep: "autonomous_verify" });
  await persistGoalLifecycle(supabase, loopRunId, current);

  // The bounded runner owns deterministic completion after observation + verification.
  // No generative provider can mark a financial goal complete by itself.
  current = advanceGoalLifecycle(current, "completed", "réévaluer si les données ou le contexte changent", { completedStep: "autonomous_evaluation", result: { observations: successCount, recommendation_only: true, autonomous_writes_allowed: false } });
  await persistGoalLifecycle(supabase, loopRunId, current);

  harness.complete("completed");
  return { loopRunId, status: "completed", stepsExecuted: observations.length, observations, nextAction: current.nextAction, progress: current.progress, harness: harness.summary() };
}
