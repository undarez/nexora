import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAgentTool } from "@/lib/agent-runtime/executor";
import { recordAgentLoopStep, recordEvidence } from "@/lib/agents/loop-engine";
import { advanceGoalLifecycle, persistGoalLifecycle, type LiaGoalLifecycle } from "@/lib/lia/goal-lifecycle";
import { chooseNextReasoningStep, type ReasoningMemory } from "@/lib/lia/reasoning-engine";

const READ_ONLY_TOOLS = new Set([
  "get_financial_snapshot",
  "get_budget_status",
  "get_cashflow",
  "get_wealth_snapshot",
  "get_forecast",
  "search_transactions",
]);

const TASK_TOOLS: Record<string, string[]> = {
  financial_analysis: ["get_financial_snapshot", "get_cashflow", "get_budget_status", "get_forecast", "search_transactions"],
  budget: ["get_budget_status", "get_cashflow", "search_transactions", "get_financial_snapshot"],
  cashflow: ["get_cashflow", "get_financial_snapshot", "get_forecast", "search_transactions"],
  wealth: ["get_wealth_snapshot", "get_financial_snapshot", "get_forecast", "get_cashflow"],
};

export type AutonomousRunResult = {
  loopRunId: string;
  status: "completed" | "blocked" | "needs_human" | "failed";
  stepsExecuted: number;
  observations: Array<{ tool: string; ok: boolean }>;
  nextAction: string;
  progress: number;
};

function inferTask(context: any): string {
  return typeof context?.task === "string" ? context.task : "financial_analysis";
}

function safeToolSet(task: string): string[] {
  return (TASK_TOOLS[task] ?? TASK_TOOLS.financial_analysis).filter((name) => READ_ONLY_TOOLS.has(name));
}

function compactObservation(result: unknown): string {
  if (result === null || result === undefined) return "Aucune donnée.";
  try {
    return JSON.stringify(result).slice(0, 1800);
  } catch {
    return String(result).slice(0, 1800);
  }
}

/**
 * Governed autonomous cognitive loop.
 *
 * The LIA provider chooses the next read-only observation from a strict allowlist.
 * Every decision is bounded, validated, recorded and followed by verification.
 * The model never receives authority to mutate financial state or mark a goal
 * complete through free-form text alone.
 */
export async function runAutonomousGoal(
  supabase: SupabaseClient,
  userId: string,
  loopRunId: string,
  maxSteps = 8,
): Promise<AutonomousRunResult> {
  const bounded = Math.max(1, Math.min(8, Math.floor(maxSteps)));
  const { data: run, error } = await supabase.from("agent_loop_runs")
    .select("id,user_id,status,goal,context,decision")
    .eq("id", loopRunId).eq("user_id", userId).single();
  if (error || !run) throw new Error("Objectif LIA introuvable.");
  if (!["running", "blocked", "needs_human"].includes(run.status)) throw new Error("Cet objectif n'est pas exécutable dans son état actuel.");

  const lifecycle = run.context?.goal_lifecycle as LiaGoalLifecycle | undefined;
  if (!lifecycle) throw new Error("État d'objectif absent ou invalide.");
  if (["completed", "failed", "blocked"].includes(lifecycle.state)) {
    return { loopRunId, status: lifecycle.state as any, stepsExecuted: 0, observations: [], nextAction: lifecycle.nextAction, progress: lifecycle.progress };
  }
  if (lifecycle.state === "needs_human") {
    return { loopRunId, status: "needs_human", stepsExecuted: 0, observations: [], nextAction: lifecycle.nextAction, progress: lifecycle.progress };
  }

  const task = inferTask(run.context);
  const tools = safeToolSet(task);
  const observations: Array<{ tool: string; ok: boolean }> = [];
  const detailedObservations: Array<{ tool: string; ok: boolean; summary?: string }> = [];
  const memory: ReasoningMemory = {
    facts: [],
    openQuestions: [],
    completedTools: [],
    failedTools: [],
    checks: [],
  };

  let current = advanceGoalLifecycle(lifecycle, "executing", "construire une observation fiable et choisir la prochaine étape", { completedStep: "reasoning_start" });
  await persistGoalLifecycle(supabase, loopRunId, current);

  for (let i = 0; i < bounded; i++) {
    const remainingSteps = bounded - i;
    const decision = await chooseNextReasoningStep({
      goal: run.goal,
      task,
      allowedTools: tools,
      memory,
      observations: detailedObservations,
      remainingSteps,
    });

    await recordAgentLoopStep(supabase, loopRunId, 10 + i, {
      phase: "decide",
      agentKey: "lia:reasoning-engine",
      input: { task, allowed_tools: tools, remaining_steps: remainingSteps, memory },
      output: { action: decision.action, tool: decision.tool, objective: decision.objective, questions: decision.questions, checks: decision.checks, confidence: decision.confidence },
      status: "completed",
    });

    memory.openQuestions = decision.questions;
    memory.checks = decision.checks;

    if (decision.action === "needs_human") {
      current = advanceGoalLifecycle(current, "needs_human", decision.objective || "Une validation humaine est nécessaire.", { completedStep: "reasoning_human_gate", questions: decision.questions });
      await persistGoalLifecycle(supabase, loopRunId, current);
      return { loopRunId, status: "needs_human", stepsExecuted: observations.length, observations, nextAction: current.nextAction, progress: current.progress };
    }

    if (decision.action === "finish" || !decision.tool) break;

    const tool = decision.tool;
    current = advanceGoalLifecycle(current, "executing", decision.objective, { completedStep: `reasoning_select:${tool}` });
    await persistGoalLifecycle(supabase, loopRunId, current);

    try {
      const result = await executeAgentTool(supabase, userId, { name: tool });
      const summary = compactObservation(result);
      observations.push({ tool, ok: true });
      detailedObservations.push({ tool, ok: true, summary });
      memory.completedTools.push(tool);
      memory.facts.push(`${tool}: ${summary.slice(0, 900)}`);

      const stepId = await recordAgentLoopStep(supabase, loopRunId, 30 + i, {
        phase: "act",
        agentKey: "lia:autonomous-runner",
        input: { tool, risk: "read", autonomous: true, objective: decision.objective },
        output: { ok: true, result: typeof result === "object" ? result as Record<string, unknown> : { value: result } },
        status: "completed",
      });
      if (result && typeof result === "object" && !Array.isArray(result)) {
        await recordEvidence(supabase, loopRunId, `tool:${tool}`, "autonomous_observation", result as Record<string, unknown>, stepId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : "outil indisponible";
      observations.push({ tool, ok: false });
      detailedObservations.push({ tool, ok: false, summary: message });
      memory.failedTools.push(tool);
      await recordAgentLoopStep(supabase, loopRunId, 30 + i, {
        phase: "observe",
        agentKey: "lia:autonomous-runner",
        input: { tool, risk: "read", autonomous: true, objective: decision.objective },
        output: { ok: false, error: message },
        status: "failed",
      });
    }

    current = advanceGoalLifecycle(current, "verifying", "vérifier la nouvelle observation avant de poursuivre", { completedStep: `reasoning_observe:${tool}` });
    await persistGoalLifecycle(supabase, loopRunId, current);
    await recordAgentLoopStep(supabase, loopRunId, 40 + i, {
      phase: "verify",
      agentKey: "lia:reasoning-engine",
      input: { tool, observations: detailedObservations.slice(-4), checks: memory.checks },
      output: { verified_observation_count: detailedObservations.length, human_authority_required: true },
      status: "completed",
    });
  }

  const successCount = observations.filter((x) => x.ok).length;
  const noToolSucceeded = observations.length > 0 && successCount === 0;
  if (noToolSucceeded) {
    current = advanceGoalLifecycle(current, "blocked", "attendre la disponibilité des outils de lecture", { blocker: "Aucune observation déterministe n'a pu être obtenue." });
    await persistGoalLifecycle(supabase, loopRunId, current);
    return { loopRunId, status: "blocked", stepsExecuted: observations.length, observations, nextAction: current.nextAction, progress: current.progress };
  }

  current = advanceGoalLifecycle(current, "evaluating", "évaluer les observations vérifiées et préparer une recommandation", {
    completedStep: "reasoning_evaluation",
    result: {
      observations: successCount,
      failed_observations: observations.length - successCount,
      reasoning_steps: detailedObservations.length,
      recommendation_only: true,
      autonomous_writes_allowed: false,
      working_memory: { facts: memory.facts.slice(-8), openQuestions: memory.openQuestions, checks: memory.checks },
    },
  });
  await persistGoalLifecycle(supabase, loopRunId, current);
  await recordAgentLoopStep(supabase, loopRunId, 80, {
    phase: "decide",
    agentKey: "lia:reasoning-engine",
    input: { observations: detailedObservations.slice(-8), memory },
    output: { recommendation_only: true, autonomous_writes_allowed: false },
    status: "completed",
  });

  current = advanceGoalLifecycle(current, "completed", "réévaluer si les données ou le contexte changent", {
    completedStep: "reasoning_completed",
    result: {
      observations: successCount,
      recommendation_only: true,
      autonomous_writes_allowed: false,
    },
  });
  await persistGoalLifecycle(supabase, loopRunId, current);

  return { loopRunId, status: "completed", stepsExecuted: observations.length, observations, nextAction: current.nextAction, progress: current.progress };
}
