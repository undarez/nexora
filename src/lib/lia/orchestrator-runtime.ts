import type { SupabaseClient } from "@supabase/supabase-js";
import { createHumanGatedProposal, planLiaAction } from "@/lib/lia/actions/planner";
import { verifyLiaStepOutput } from "@/lib/lia/verification-engine";
import { decideLiaRecovery } from "@/lib/lia/adaptive-recovery";
import { evaluateLiaGoal, persistLiaGoalEvaluation } from "@/lib/lia/goal-completion";
import { persistStrategyExperience, strategyScoreForOutcome } from "@/lib/lia/strategy-learning";
import { executeAgentTool } from "@/lib/agent-runtime/executor";
import { runLiveResearch } from "@/lib/lia/research/live";

export type OrchestrationRuntimeResult = {
  runId: string;
  status: string;
  step: { id: string; index: number; procedure: string; status: string } | null;
  output: Record<string, unknown>;
  nextStep: number | null;
};

function cleanContext(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function recordStrategy(args: { supabase: SupabaseClient; userId: string; run: any; outcome: 'completed'|'continue'|'needs_human'|'blocked'|'failed'; context?: unknown }) {
  const strategyKey = typeof args.run.strategy_key === "string" ? args.run.strategy_key : String(cleanContext(args.run.context).strategy_key ?? "unknown");
  if (!strategyKey || strategyKey === "unknown") return;
  const scored = strategyScoreForOutcome(args.outcome);
  await persistStrategyExperience({
    supabase: args.supabase, userId: args.userId, goalKey: String(args.run.objective).trim().slice(0,160),
    strategyKey, outcome: scored.outcome, score: scored.score, context: args.context ?? {},
    evidence: [{ orchestration_run_id: args.run.id, outcome: args.outcome }]
  });
}

/** Advances exactly one bounded orchestration step. It never executes an external write directly. */
export async function advanceLiaOrchestration(args: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  action?: { actionKey?: unknown; title?: unknown; description?: unknown; payload?: unknown };
}): Promise<OrchestrationRuntimeResult> {
  const { data: run, error: runError } = await args.supabase
    .from("lia_orchestration_runs")
    .select("id,user_id,status,max_steps,current_step,objective,context,result,strategy_key")
    .eq("id", args.runId).eq("user_id", args.userId).single();
  if (runError || !run) throw new Error("Orchestration introuvable.");
  if (["completed", "failed", "blocked", "cancelled"].includes(run.status)) {
    return { runId: run.id, status: run.status, step: null, output: cleanContext(run.result), nextStep: null };
  }

  const { data: step, error: stepError } = await args.supabase
    .from("lia_orchestration_steps")
    .select("id,step_index,procedure_slug,status,risk_class,human_gate_required,objective,verification_rules,input_context,output_context,retry_count")
    .eq("run_id", run.id).eq("step_index", Number(run.current_step) + 1).maybeSingle();
  if (stepError) throw new Error(stepError.message);
  if (!step) {
    await args.supabase.from("lia_orchestration_runs").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", run.id);
    return { runId: run.id, status: "completed", step: null, output: { reason: "Toutes les étapes sont terminées." }, nextStep: null };
  }
  if (["completed", "skipped"].includes(step.status)) {
    return { runId: run.id, status: run.status, step: { id: step.id, index: step.step_index, procedure: step.procedure_slug ?? "", status: step.status }, output: cleanContext(step.output_context), nextStep: step.step_index + 1 <= run.max_steps ? step.step_index + 1 : null };
  }

  const now = new Date().toISOString();
  if (step.status === "blocked") {
    await args.supabase.from("lia_orchestration_runs").update({ status: "blocked", updated_at: now, result: { reason: "Étape bloquée par les limites de gouvernance.", step_id: step.id } }).eq("id", run.id);
    return { runId: run.id, status: "blocked", step: { id: step.id, index: step.step_index, procedure: step.procedure_slug ?? "", status: "blocked" }, output: { reason: "Étape bloquée." }, nextStep: null };
  }

  await args.supabase.from("lia_orchestration_runs").update({ status: "running", updated_at: now }).eq("id", run.id);
  await args.supabase.from("lia_orchestration_steps").update({ status: "running", input_context: { objective: run.objective, inherited: cleanContext(run.context) } }).eq("id", step.id);

  const slug = step.procedure_slug ?? "";
  let output: Record<string, unknown> = {};
  let nextStatus: "completed" | "awaiting_human" | "failed" = "completed";

  if (slug === "human_gate_sensitive_action") {
    const actionKey = typeof args.action?.actionKey === "string" ? args.action.actionKey : "create_recommendation";
    const title = typeof args.action?.title === "string" ? args.action.title : "Action proposée par LIA";
    const description = typeof args.action?.description === "string" ? args.action.description : run.objective;
    const payload = cleanContext(args.action?.payload);
    const proposal = await createHumanGatedProposal({
      supabase: args.supabase, userId: args.userId, loopRunId: run.id,
      plan: planLiaAction({ actionKey, title, description, payload, autonomyLevel: 1 }),
    });
    output = { proposal_id: proposal.id, human_gate: true, requires_approval: true };
    nextStatus = "awaiting_human";
  } else if (slug === "financial_snapshot_review") {
    const snapshot = await executeAgentTool(args.supabase, args.userId, { name: "get_financial_snapshot" });
    output = { observation_only: true, procedure: slug, verified: true, snapshot, autonomous: true, financial_writes_allowed: false };
  } else if (slug === "budget_health_check") {
    const [budget, cashflow] = await Promise.all([
      executeAgentTool(args.supabase, args.userId, { name: "get_budget_status" }),
      executeAgentTool(args.supabase, args.userId, { name: "get_cashflow", arguments: { days: 90 } }),
    ]);
    output = { observation_only: true, procedure: slug, verified: true, budget, cashflow, autonomous: true, financial_writes_allowed: false };
  } else if (slug === "research_and_verify") {
    const research = await runLiveResearch({ query: run.objective, maxSources: 5, discover: true });
    output = { research_requested: true, procedure: slug, verified: research.minimumEvidenceMet === true, research, autonomous: true, financial_writes_allowed: false };
  } else if (slug === "relational_adaptation") {
    const { data: relationship } = await args.supabase.from("lia_user_relationship_profiles").select("consented_personalization,initiative_level,detail_level,communication_style").eq("user_id", args.userId).maybeSingle();
    const consented = relationship?.consented_personalization === true;
    output = { personalization_applied: consented, procedure: slug, verified: consented, relationship: relationship ?? null, note: "La personnalisation modifie le style/contexte, jamais les politiques de sécurité." };
  } else {
    output = { procedure: slug, verified: false, note: "Procédure inconnue pour le runtime." };
    nextStatus = "failed";
  }

  const finishedAt = new Date().toISOString();
  if (nextStatus === "completed") {
    const verification = verifyLiaStepOutput(output, step.verification_rules);
    if (!verification.verified) {
      const retries = Number(step.retry_count ?? 0) + 1;
      const recovery = decideLiaRecovery({ procedure: slug, retryCount: retries, error: "verification_failed", verification });
      const terminal = !recovery.retryAllowed || recovery.strategy === "stop";
      const nextProcedure = recovery.nextProcedure && recovery.nextProcedure !== slug ? recovery.nextProcedure : slug;
      const recoveryOutput = { ...output, verification, recovery };
      await args.supabase.from("lia_orchestration_steps").update({
        status: terminal ? "failed" : "planned",
        procedure_slug: terminal ? slug : nextProcedure,
        output_context: recoveryOutput,
        last_error: "verification_failed",
        retry_count: retries,
        recovery_strategy: recovery.strategy,
        recovery_reason: recovery.reason,
      }).eq("id", step.id).eq("status", "running");
      await args.supabase.from("lia_orchestration_runs").update({ status: terminal ? "failed" : "running", updated_at: finishedAt, result: { last_step: step.step_index, output, verification, recovery, retry_count: retries } }).eq("id", run.id);
      if (terminal) await recordStrategy({ supabase: args.supabase, userId: args.userId, run, outcome: "failed", context: { step_id: step.id, verification, recovery } });
      return { runId: run.id, status: terminal ? "failed" : "running", step: { id: step.id, index: step.step_index, procedure: nextProcedure, status: terminal ? "failed" : "planned" }, output: recoveryOutput, nextStep: terminal ? null : step.step_index };
    }
    const nextStep = step.step_index < run.max_steps ? step.step_index + 1 : null;
    await args.supabase.from("lia_orchestration_steps").update({ status: "completed", output_context: { ...output, verification }, verified_at: finishedAt, completed_at: finishedAt }).eq("id", step.id).eq("status", "running");
    const proposedResult = { last_step: step.step_index, output, verification };
    const nextStatus = nextStep ? "running" : "completed";
    await args.supabase.from("lia_orchestration_runs").update({ status: nextStatus, current_step: step.step_index, completed_at: nextStep ? null : finishedAt, updated_at: finishedAt, result: proposedResult }).eq("id", run.id);
    const criteria = cleanContext(run.context).success_criteria;
    if (!nextStep || Array.isArray(criteria)) {
      const { data: allSteps } = await args.supabase.from("lia_orchestration_steps").select("status,output_context").eq("run_id", run.id).order("step_index", { ascending: true });
      const evaluation = evaluateLiaGoal({ objective: run.objective, successCriteria: criteria, result: proposedResult, steps: allSteps ?? [], orchestrationStatus: nextStatus });
      await persistLiaGoalEvaluation({ supabase: args.supabase, userId: args.userId, runId: run.id, evaluation });
      await recordStrategy({ supabase: args.supabase, userId: args.userId, run, outcome: evaluation.status, context: { evaluation } });
    }
    return { runId: run.id, status: nextStatus, step: { id: step.id, index: step.step_index, procedure: slug, status: "completed" }, output: { ...output, verification }, nextStep };
  }
  await args.supabase.from("lia_orchestration_steps").update({ status: nextStatus, output_context: output }).eq("id", step.id).eq("status", "running");
  const terminalStatus = nextStatus === "awaiting_human" ? "awaiting_human" : "failed";
  await args.supabase.from("lia_orchestration_runs").update({ status: terminalStatus, updated_at: finishedAt, result: { last_step: step.step_index, output } }).eq("id", run.id);
  await recordStrategy({ supabase: args.supabase, userId: args.userId, run, outcome: terminalStatus === "awaiting_human" ? "needs_human" : "failed", context: { step_id: step.id, output } });
  const nextStep = null;
  return { runId: run.id, status: nextStatus, step: { id: step.id, index: step.step_index, procedure: slug, status: nextStatus }, output, nextStep };
}

export type AutonomousOrchestrationResult = {
  runId: string;
  status: string;
  stepsExecuted: number;
  trace: Array<Record<string, unknown>>;
  nextStep: number | null;
};

/** Runs a bounded orchestration until completion, a human gate, a block, or a failure.
 * It never loops without a hard step budget and delegates each step to the governed runtime.
 */
export async function runLiaOrchestration(args: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  maxSteps?: number;
  action?: { actionKey?: unknown; title?: unknown; description?: unknown; payload?: unknown };
}): Promise<AutonomousOrchestrationResult> {
  const requestedBudget = Math.max(1, Math.min(5, Math.floor(args.maxSteps ?? 5)));
  const { data: persistedRun } = await args.supabase.from("lia_orchestration_runs").select("max_steps,status,current_step").eq("id", args.runId).eq("user_id", args.userId).maybeSingle();
  const persistedMaxSteps = Number(persistedRun?.max_steps ?? requestedBudget);
  const budget = Math.max(1, Math.min(requestedBudget, persistedMaxSteps));
  const trace: Array<Record<string, unknown>> = [];
  for (let i = 0; i < budget; i++) {
    const result = await advanceLiaOrchestration({ ...args });
    if (result.step) {
      trace.push({
        step: result.step.index,
        procedure: result.step.procedure,
        status: result.step.status,
        run_status: result.status,
        next_step: result.nextStep,
        output: result.output,
      });
    }
    if (["completed", "awaiting_human", "blocked", "failed", "cancelled"].includes(result.status)) {
      return { runId: result.runId, status: result.status, stepsExecuted: trace.length, trace, nextStep: result.nextStep };
    }
  }
  return { runId: args.runId, status: "running", stepsExecuted: trace.length, trace, nextStep: trace.at(-1)?.next_step as number | null ?? null };
}
