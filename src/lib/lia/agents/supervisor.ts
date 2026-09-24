import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buildLiaCommandPlan } from "../command/index.ts";
import { executeSpecialistCommand } from "./executor.ts";
import { routeLiaIntent } from "../command/router.ts";
import type { LiaCommandIntent } from "../command/types.ts";
import type { LiaMissionEvidence, LiaMissionOptions, LiaMissionResult, LiaMissionTask } from "./supervisor-types.ts";

const MAX_OBJECTIVE_LENGTH = 4000;
const MAX_HANDOFF_LENGTH = 3500;
const MAX_OUTPUT_LENGTH = 5000;

type MissionContext = { userId: string; requestId?: string; locale?: string };

const FALLBACK_INTENTS: Partial<Record<LiaCommandIntent, LiaCommandIntent>> = {
  "finance.spending.analyze": "finance.transactions.read",
  "finance.budget.read": "finance.transactions.read",
  "finance.goal.read": "finance.budget.read",
  "research.learn": "research.search",
  "system.diagnostics": "system.health_check",
  "data.deduplicate": "data.quality_check",
  "mobility.vehicle.read": "mobility.fuel.read",
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createAdminClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

function splitMissionObjective(objective: string): string[] {
  const normalized = objective.trim().slice(0, MAX_OBJECTIVE_LENGTH);
  if (!normalized) return [];
  const parts = normalized
    .split(/\s+(?:et puis|ensuite|puis)\s+|\s*;\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts.slice(0, 10) : [normalized];
}

function taskFromInput(input: string, index: number, forcedIntent?: LiaCommandIntent, suffix = ""): LiaMissionTask {
  const plan = buildLiaCommandPlan(input);
  const route = forcedIntent ? routeLiaIntent(forcedIntent) : plan.route;
  return {
    id: "mission-task-" + String(index + 1) + suffix,
    intent: forcedIntent ?? plan.intent.intent,
    input,
    agentId: route.agent,
    skillId: route.skill,
    dependsOn: index === 0 ? [] : ["mission-task-" + String(index)],
  };
}

function compact(value: unknown, max: number): unknown {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length <= max) return value;
    return serialized.slice(0, max) + "…";
  } catch {
    return String(value).slice(0, max);
  }
}

function critiqueMission(evidence: LiaMissionEvidence[]) {
  const reasons: string[] = [];
  for (const item of evidence) {
    if (item.status !== "completed") reasons.push("Task " + item.taskId + " did not complete.");
    if (
      item.verification &&
      typeof item.verification === "object" &&
      "passed" in item.verification &&
      item.verification.passed !== true
    ) {
      reasons.push("Task " + item.taskId + " failed verification.");
    }
  }
  return { passed: evidence.length > 0 && reasons.length === 0, reasons };
}

function riskFromResult(status: string): "read" | "write" | "critical" {
  return status === "waiting_confirmation" ? "write" : "read";
}

async function startPersistentRun(
  context: MissionContext,
  objective: string,
  options: LiaMissionOptions,
  maxSteps: number,
  maxReplans: number,
) {
  const admin = getAdminClient();
  if (!admin) return { admin, missionId: undefined as string | undefined };
  const { data, error } = await admin.rpc("lia_orchestration_start_run", {
    p_user_id: context.userId,
    p_objective: objective,
    p_max_steps: maxSteps,
    p_max_replans: maxReplans,
    p_max_tool_calls: 8,
    p_max_retries: 4,
    p_max_research_requests: 3,
    p_max_memory_writes: 5,
    p_context: {
      request_id: context.requestId ?? null,
      locale: context.locale ?? null,
      user_autonomy_level: options.userAutonomyLevel ?? null,
    },
  });
  if (error || !data) throw new Error("orchestration_persistence_unavailable:" + (error?.message ?? "missing_run_id"));
  return { admin, missionId: String(data) };
}

async function persistStep(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  context: MissionContext,
  missionId: string,
  task: LiaMissionTask,
  stepIndex: number,
  status: string,
  output: unknown,
  verification: unknown,
  handoffContext: unknown,
  parentStepId?: string,
  recoveryStrategy?: string,
) {
  const plan = buildLiaCommandPlan(task.input);
  const { data, error } = await admin.rpc("lia_orchestration_upsert_step", {
    p_run_id: missionId,
    p_user_id: context.userId,
    p_step_index: stepIndex + 1,
    p_objective: task.input,
    p_status: status,
    p_risk_class: riskFromResult(status),
    p_human_gate_required: status === "waiting_confirmation",
    p_verification_rules: [{ type: "skill_runtime", required: true }],
    p_input_context: { intent: task.intent, agent_id: task.agentId, skill_id: task.skillId },
    p_output_context: compact(output, MAX_OUTPUT_LENGTH),
    p_parent_step_id: parentStepId ?? null,
    p_depends_on: task.dependsOn
      .map((id) => Number(id.match(/mission-task-(\d+)/)?.[1] ?? 0))
      .filter((value) => Number.isInteger(value) && value >= 0),
    p_agent_key: task.agentId,
    p_execution_policy: {
      mode: plan.policy.mode,
      risk: plan.policy.risk,
      requires_confirmation: plan.policy.requiresConfirmation,
    },
    p_handoff_context: compact(handoffContext, MAX_HANDOFF_LENGTH),
    p_evidence_refs: [{ task_id: task.id, verification }],
    p_retry_count: 0,
    p_last_error: status === "failed" ? String((output as Record<string, unknown>)?.error ?? "task_failed") : null,
    p_recovery_strategy: recoveryStrategy ?? null,
    p_recovery_reason: recoveryStrategy ? "bounded_governed_replan" : null,
  });
  if (error || !data) throw new Error("orchestration_step_persistence_failed:" + (error?.message ?? "missing_step_id"));
  return String(data);
}

async function consumeOrchestrationBudget(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  missionId: string,
  userId: string,
  dimension: string,
) {
  const { data, error } = await admin.rpc("lia_consume_orchestration_budget", {
    p_run_id: missionId,
    p_user_id: userId,
    p_dimension: dimension,
    p_amount: 1,
  });
  if (error) throw new Error("orchestration_budget_unavailable:" + error.message);
  return data as { allowed?: boolean; reason?: string; remaining?: number };
}

async function updateRun(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  context: MissionContext,
  missionId: string,
  status: string,
  currentStep: number,
  result: Record<string, unknown>,
  replanReason?: string,
) {
  const { error } = await admin.rpc("lia_orchestration_update_run", {
    p_run_id: missionId,
    p_user_id: context.userId,
    p_status: status,
    p_current_step: Math.max(1, Math.min(currentStep, 5)),
    p_context: { request_id: context.requestId ?? null, locale: context.locale ?? null },
    p_result: compact(result, MAX_OUTPUT_LENGTH),
    p_replan_reason: replanReason ?? null,
  });
  if (error) throw new Error("orchestration_run_persistence_failed:" + error.message);
}

async function writeSupervisorMemory(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  context: MissionContext,
  objective: string,
  status: string,
  evidence: LiaMissionEvidence[],
  replans: LiaMissionResult["replans"],
) {
  const { data, error } = await admin.rpc("lia_orchestration_write_work_memory", {
    p_run_id: missionId,
    p_user_id: context.userId,
    p_memory: {
      objective: compact(objective, 1200),
      status,
      evidence: compact(evidence.slice(-5), 3000),
      replans: compact(replans.slice(-3), 1200),
      updated_at: new Date().toISOString(),
    },
  });
  return !error && data === true;
}

function buildReplannedTask(failedTask: LiaMissionTask, nextIndex: number): LiaMissionTask | null {
  const fallbackIntent = FALLBACK_INTENTS[failedTask.intent as LiaCommandIntent];
  if (!fallbackIntent) return null;
  const route = routeLiaIntent(fallbackIntent);
  return {
    id: "mission-task-" + String(nextIndex + 1) + "-r1",
    intent: fallbackIntent,
    input: failedTask.input,
    agentId: route.agent,
    skillId: route.skill,
    dependsOn: failedTask.dependsOn,
  };
}

function rewireDependencies(tasks: LiaMissionTask[], fromId: string, toId: string): LiaMissionTask[] {
  return tasks.map((task) => ({
    ...task,
    dependsOn: task.dependsOn.map((dependency) => dependency === fromId ? toId : dependency),
  }));
}

export async function runLiaMission(
  objective: string,
  context: MissionContext,
  options: LiaMissionOptions = {},
): Promise<LiaMissionResult> {
  const inputs = splitMissionObjective(objective);
  const maxSteps = Math.max(0, Math.min(options.maxSteps ?? 5, 5));
  const maxReplans = Math.max(0, Math.min(options.maxReplans ?? 2, 10));

  if (!inputs.length || maxSteps === 0) {
    return {
      status: "failed",
      objective,
      tasks: [],
      evidence: [],
      replans: [],
      critique: { passed: false, reasons: ["Mission objective or execution budget is invalid."] },
      memoryWritten: false,
      output: { error: "mission_budget_or_objective_invalid" },
    };
  }

  const { admin, missionId } = await startPersistentRun(context, objective, options, maxSteps, maxReplans);
  const requirePersistence = process.env.NODE_ENV === "production" || process.env.LIA_SUPERVISOR_REQUIRE_PERSISTENCE === "true";

  if ((!missionId || !admin) && requirePersistence) {
    return {
      status: "failed",
      objective,
      tasks: [],
      evidence: [],
      replans: [],
      critique: { passed: false, reasons: ["Supervisor persistence is unavailable in the current runtime."] },
      memoryWritten: false,
      output: { error: "orchestration_persistence_unavailable" },
    };
  }

  let tasks = inputs.map((input, index) => taskFromInput(input, index));
  const evidence: LiaMissionEvidence[] = [];
  const replans: LiaMissionResult["replans"] = [];
  let lastOutput: Record<string, unknown> = {};
  let waitingConfirmation = false;
  let stepIndex = 0;
  let taskPosition = 0;

  try {
    while (taskPosition < tasks.length && stepIndex < maxSteps) {
      const task = tasks[taskPosition];
      if (missionId && admin) {
        const stepBudget = await consumeOrchestrationBudget(admin, missionId, context.userId, "steps");
        const toolBudget = await consumeOrchestrationBudget(admin, missionId, context.userId, "tool_calls");
        if (stepBudget.allowed !== true || toolBudget.allowed !== true) {
          lastOutput = { error: stepBudget.reason ?? toolBudget.reason ?? "orchestration_budget_exhausted" };
          await updateRun(admin, context, missionId, "blocked", stepIndex, lastOutput);
          break;
        }
        await persistStep(admin, context, missionId, task, stepIndex, "running", {}, {}, evidence.at(-1)?.output);
      }

      const result = await executeSpecialistCommand(task.input, context);
      lastOutput = result.output;
      evidence.push({
        taskId: task.id,
        agentId: task.agentId,
        skillId: task.skillId,
        status: result.status,
        verification: result.verification,
        output: result.output,
      });

      if (missionId && admin) {
        await persistStep(
          admin,
          context,
          missionId,
          task,
          stepIndex,
          result.status === "waiting_confirmation" ? "waiting" : result.status === "completed" ? "completed" : "failed",
          result.output,
          result.verification,
          evidence.length > 1 ? evidence[evidence.length - 2] : null,
        );
      }

      if (result.status === "waiting_confirmation") {
        waitingConfirmation = true;
        break;
      }

      if (result.status !== "completed") {
        const replanned = buildReplannedTask(task, tasks.length);
        if (replanned && replans.length < maxReplans && missionId && admin) {
          const replan = await admin.rpc("lia_orchestration_request_replan", {
            p_run_id: missionId,
            p_user_id: context.userId,
            p_reason: "Specialist task failed; selected a bounded fallback route.",
          });
          if (replan.data?.allowed === true && stepIndex + 1 < maxSteps) {
            replans.push({
              reason: "Specialist task failed; selected a bounded governed fallback.",
              fromTask: task.id,
              toSkill: replanned.skillId,
            });
            tasks = rewireDependencies(tasks, task.id, replanned.id);
            tasks.splice(taskPosition, 1, replanned);
            if (missionId && admin) {
              await persistStep(
                admin,
                context,
                missionId,
                replanned,
                stepIndex + 1,
                "planned",
                {},
                {},
                evidence.at(-1)?.output,
                undefined,
                replanned.skillId,
              );
            }
            stepIndex += 1;
            continue;
          }
        }
        break;
      }

      stepIndex += 1;
      taskPosition += 1;
    }

    const critique = critiqueMission(evidence);
    const status: LiaMissionResult["status"] = waitingConfirmation
      ? "waiting_confirmation"
      : critique.passed
        ? "completed"
        : replans.length > 0
          ? "partial"
          : "failed";

    let memoryWritten = false;
    if (missionId && admin) {
      memoryWritten = await writeSupervisorMemory(admin, context, objective, status, evidence, replans);
      await updateRun(admin, context, missionId, status, stepIndex, lastOutput, replans.at(-1)?.reason);
    }

    return {
      status,
      missionId,
      objective,
      tasks,
      evidence,
      replans,
      critique,
      memoryWritten,
      output: lastOutput,
    };
  } catch (error) {
    if (missionId && admin) {
      try {
        await updateRun(admin, context, missionId, "failed", stepIndex, {
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // Preserve the original supervisor failure.
      }
    }
    return {
      status: "failed",
      missionId,
      objective,
      tasks,
      evidence,
      replans,
      critique: { passed: false, reasons: ["Supervisor orchestration failed unexpectedly."] },
      memoryWritten: false,
      output: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

export const runAutonomousMission = runLiaMission;

export { splitMissionObjective, critiqueMission, taskFromInput, buildReplannedTask, rewireDependencies };
