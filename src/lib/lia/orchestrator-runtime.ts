import type { SupabaseClient } from "@supabase/supabase-js";
import { createHumanGatedProposal, planLiaAction } from "@/lib/lia/actions/planner";
import { verifyLiaStepOutput } from "@/lib/lia/verification-engine";
import { decideLiaRecovery } from "@/lib/lia/adaptive-recovery";
import { evaluateLiaGoal, persistLiaGoalEvaluation } from "@/lib/lia/goal-completion";
import { persistStrategyExperience, strategyScoreForOutcome } from "@/lib/lia/strategy-learning";
import { executeAgentTool } from "@/lib/agent-runtime/executor";
import { runLiveResearch } from "@/lib/lia/research/live";
import { agentKeyForProcedure, buildLiaOrchestrationPlan } from "@/lib/lia/orchestrator";

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


async function replanLiaOrchestration(args: {
  supabase: SupabaseClient;
  userId: string;
  run: any;
  failedProcedure: string;
  reason: string;
}) {
  const replanCount = Number(args.run.replan_count ?? 0);
  const maxReplans = 2;
  if (replanCount >= maxReplans) return { replanned: false, reason: "replan_budget_exhausted" };

  const currentStep = Number(args.run.current_step ?? 0);
  const remaining = Math.max(1, Number(args.run.max_steps ?? 1) - currentStep);
  const plan = await buildLiaOrchestrationPlan({
    supabase: args.supabase,
    userId: args.userId,
    objective: String(args.run.objective ?? ""),
    maxSteps: remaining,
    excludeProcedureSlugs: [args.failedProcedure],
  });
  if (!plan.steps.length) return { replanned: false, reason: "no_safe_alternative_plan" };

  const firstIndex = currentStep + 1;
  const { data: existingSteps, error: existingError } = await args.supabase
    .from("lia_orchestration_steps")
    .select("id,step_index,status")
    .eq("run_id", args.run.id)
    .gte("step_index", firstIndex)
    .order("step_index", { ascending: true });
  if (existingError) throw new Error(existingError.message);

  const reusable = (existingSteps ?? []).filter((row: any) => !["completed", "skipped"].includes(String(row.status)));
  const applied: number[] = [];

  for (let i = 0; i < plan.steps.length; i++) {
    const planned = plan.steps[i];
    const index = firstIndex + i;
    const existing = reusable[i];
    const payload = {
      step_index: index,
      procedure_id: planned.procedure.id,
      procedure_slug: planned.procedure.slug,
      objective: planned.objective,
      status: planned.status,
      risk_class: planned.riskClass,
      human_gate_required: planned.humanGateRequired,
      verification_rules: planned.verificationRules,
      input_context: { replanned: true, replaced_procedure: args.failedProcedure, replan_reason: args.reason },
      output_context: {},
      parent_step_id: null,
      depends_on: index > 1 ? [index - 1] : [],
      agent_key: agentKeyForProcedure(planned.procedure.slug),
      execution_policy: {
        read_only: !planned.humanGateRequired,
        human_gate_required: planned.humanGateRequired,
        risk_class: planned.riskClass,
        max_retries: 2,
        permission_grant: false,
      },
      retry_count: 0,
      last_error: null,
      verified_at: null,
      completed_at: null,
      recovery_strategy: null,
      recovery_reason: "Replan gouverné : " + args.reason,
    };
    if (existing) {
      const { error } = await args.supabase.from("lia_orchestration_steps").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await args.supabase.from("lia_orchestration_steps").insert({ run_id: args.run.id, ...payload });
      if (error) throw new Error(error.message);
    }
    applied.push(index);
  }

  const keepUntil = firstIndex + plan.steps.length - 1;
  const obsoleteIds = reusable.filter((row: any) => Number(row.step_index) > keepUntil).map((row: any) => row.id);
  if (obsoleteIds.length) {
    const { error } = await args.supabase.from("lia_orchestration_steps").delete().in("id", obsoleteIds);
    if (error) throw new Error(error.message);
  }

  const nextReplanCount = replanCount + 1;
  const previousResult = cleanContext(args.run.result);
  const history = Array.isArray(previousResult.replan_history) ? previousResult.replan_history : [];
  const replanRecord = {
    at: new Date().toISOString(),
    from_step: firstIndex,
    failed_procedure: args.failedProcedure,
    reason: args.reason,
    replacement_steps: plan.steps.map(step => ({ index: firstIndex + step.index - 1, procedure: step.procedure.slug })),
    strategy_key: plan.strategyKey,
  };
  const nextStatus = plan.status === "blocked" ? "blocked" : plan.status === "awaiting_human" ? "awaiting_human" : "running";
  const { error: runError } = await args.supabase
    .from("lia_orchestration_runs")
    .update({
      status: nextStatus,
      plan_version: Number(args.run.plan_version ?? 1) + 1,
      replan_count: nextReplanCount,
      replan_reason: args.reason,
      replanned_at: new Date().toISOString(),
      strategy_key: plan.strategyKey,
      result: { ...previousResult, replan_history: [...history, replanRecord].slice(-5), replan: replanRecord, reason: "Task graph replanned after verification failure." },
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.run.id);
  if (runError) throw new Error(runError.message);

  return {
    replanned: true,
    nextStatus,
    planVersion: Number(args.run.plan_version ?? 1) + 1,
    replanCount: nextReplanCount,
    appliedSteps: applied,
    strategyKey: plan.strategyKey,
  };
}


function buildStepEvidence(procedure: string, output: Record<string, unknown>, verified: boolean) {
  const keys = Object.keys(output).filter(key => key !== "verification").slice(0, 12);
  return [{
    kind: "orchestration_step_output",
    procedure,
    verified,
    output_keys: keys,
  }];
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
    .select("id,user_id,status,max_steps,current_step,objective,context,result,strategy_key,plan_version,replan_count,replan_reason,replanned_at")
    .eq("id", args.runId).eq("user_id", args.userId).single();
  if (runError || !run) throw new Error("Orchestration introuvable.");
  if (["completed", "failed", "blocked", "cancelled"].includes(run.status)) {
    return { runId: run.id, status: run.status, step: null, output: cleanContext(run.result), nextStep: null };
  }

  const { data: step, error: stepError } = await args.supabase
    .from("lia_orchestration_steps")
    .select("id,step_index,procedure_slug,status,risk_class,human_gate_required,objective,verification_rules,input_context,output_context,retry_count,depends_on,agent_key,execution_policy,handoff_context,evidence_refs")
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
  const dependencies = Array.isArray(step.depends_on) ? step.depends_on.map(Number).filter(Number.isFinite) : [];
  if (dependencies.length) {
    const { data: dependencyRows, error: dependencyError } = await args.supabase
      .from("lia_orchestration_steps")
      .select("step_index,status")
      .eq("run_id", run.id)
      .in("step_index", dependencies);
    if (dependencyError) throw new Error(dependencyError.message);
    const incomplete = dependencies.filter(index => !dependencyRows?.some(row => Number(row.step_index) === index && row.status === "completed"));
    if (incomplete.length) {
      await args.supabase.from("lia_orchestration_steps").update({ status: "planned", recovery_strategy: "wait_for_dependencies", recovery_reason: `Dépendances non terminées : ${incomplete.join(", ")}` }).eq("id", step.id);
      return { runId: run.id, status: "running", step: { id: step.id, index: step.step_index, procedure: step.procedure_slug ?? "", status: "planned" }, output: { blocked_by_dependencies: incomplete, agent_key: step.agent_key ?? null }, nextStep: step.step_index };
    }
  }
  if (step.status === "blocked") {
    await args.supabase.from("lia_orchestration_runs").update({ status: "blocked", updated_at: now, result: { reason: "Étape bloquée par les limites de gouvernance.", step_id: step.id } }).eq("id", run.id);
    return { runId: run.id, status: "blocked", step: { id: step.id, index: step.step_index, procedure: step.procedure_slug ?? "", status: "blocked" }, output: { reason: "Étape bloquée." }, nextStep: null };
  }

  let previousStepOutput: Record<string, unknown> = {};
  let previousAgentKey: string | null = null;
  if (step.step_index > 1) {
    const { data: previousStep } = await args.supabase
      .from("lia_orchestration_steps")
      .select("procedure_slug,agent_key,output_context,status")
      .eq("run_id", run.id)
      .eq("step_index", step.step_index - 1)
      .maybeSingle();
    if (previousStep?.status === "completed") {
      previousStepOutput = cleanContext(previousStep.output_context);
      previousAgentKey = typeof previousStep.agent_key === "string" ? previousStep.agent_key : null;
    }
  }

  const handoffContext = {
    from_agent: previousAgentKey,
    to_agent: step.agent_key ?? null,
    from_step: step.step_index > 1 ? step.step_index - 1 : null,
    to_step: step.step_index,
    verified_source: Object.keys(previousStepOutput).length > 0,
    evidence: Array.isArray(previousStepOutput.evidence_refs) ? previousStepOutput.evidence_refs : [],
  };

  await args.supabase.from("lia_orchestration_runs").update({ status: "running", updated_at: now }).eq("id", run.id);
  await args.supabase.from("lia_orchestration_steps").update({
    status: "running",
    input_context: { objective: run.objective, inherited: cleanContext(run.context), previous_step_output: previousStepOutput, handoff: handoffContext },
    handoff_context: handoffContext,
  }).eq("id", step.id);

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

      if (terminal) {
        const replan = await replanLiaOrchestration({
          supabase: args.supabase,
          userId: args.userId,
          run,
          failedProcedure: slug,
          reason: "Vérification échouée à l'étape " + step.step_index + " : " + recovery.reason,
        });
        if (replan.replanned) {
          const refreshed = await args.supabase
            .from("lia_orchestration_steps")
            .select("id,step_index,procedure_slug,status")
            .eq("run_id", run.id)
            .eq("step_index", step.step_index)
            .maybeSingle();
          const replannedStep = refreshed.data;
          return {
            runId: run.id,
            status: replan.nextStatus,
            step: replannedStep
              ? { id: replannedStep.id, index: replannedStep.step_index, procedure: replannedStep.procedure_slug ?? "", status: replannedStep.status }
              : { id: step.id, index: step.step_index, procedure: nextProcedure, status: "planned" },
            output: { ...recoveryOutput, replan },
            nextStep: replan.nextStatus === "running" ? step.step_index : null,
          };
        }
      }

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
    const evidenceRefs = buildStepEvidence(slug, output, true);
    const outputWithHandoff = {
      ...output,
      verification,
      evidence_refs: evidenceRefs,
      handoff: {
        from_agent: step.agent_key ?? null,
        next_step: nextStep,
        verified: true,
      },
    };
    await args.supabase.from("lia_orchestration_steps").update({
      status: "completed",
      output_context: outputWithHandoff,
      evidence_refs: evidenceRefs,
      verified_at: finishedAt,
      completed_at: finishedAt
    }).eq("id", step.id).eq("status", "running");
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
    return { runId: run.id, status: nextStatus, step: { id: step.id, index: step.step_index, procedure: slug, status: "completed" }, output: outputWithHandoff, nextStep };
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
