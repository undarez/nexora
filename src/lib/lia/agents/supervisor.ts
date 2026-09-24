import { buildLiaCommandPlan } from "../command/index.ts";
import { executeSpecialistCommand } from "./executor.ts";
import type { LiaMissionOptions, LiaMissionResult, LiaMissionTask } from "./supervisor-types.ts";

const MAX_OBJECTIVE_LENGTH = 4000;

function splitMissionObjective(objective: string): string[] {
  const normalized = objective.trim().slice(0, MAX_OBJECTIVE_LENGTH);
  if (!normalized) return [];
  const parts = normalized
    .split(/\s+(?:et puis|ensuite|puis)\s+|\s*;\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts.slice(0, 10) : [normalized];
}

function taskFromInput(input: string, index: number): LiaMissionTask {
  const plan = buildLiaCommandPlan(input);
  return {
    id: "mission-task-" + String(index + 1),
    intent: plan.intent.intent,
    input,
    agentId: plan.route.agent,
    skillId: plan.route.skill,
    dependsOn: index === 0 ? [] : ["mission-task-" + String(index)],
  };
}

function critiqueMission(evidence: LiaMissionResult["evidence"]) {
  const reasons: string[] = [];
  for (const item of evidence) {
    if (item.status !== "completed") reasons.push("Task " + item.taskId + " did not complete.");
    if (item.verification && typeof item.verification === "object" && "passed" in item.verification && item.verification.passed !== true) {
      reasons.push("Task " + item.taskId + " failed verification.");
    }
  }
  return { passed: evidence.length > 0 && reasons.length === 0, reasons };
}

export async function runLiaMission(
  objective: string,
  context: { userId: string; requestId?: string; locale?: string },
  options: LiaMissionOptions = {},
): Promise<LiaMissionResult> {
  const inputs = splitMissionObjective(objective);
  const maxSteps = Math.max(0, Math.min(options.maxSteps ?? 5, 50));
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

  const tasks = inputs.slice(0, maxSteps).map(taskFromInput);
  const evidence: LiaMissionResult["evidence"] = [];
  const replans: LiaMissionResult["replans"] = [];
  let lastOutput: Record<string, unknown> = {};

  for (const task of tasks) {
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

    if (result.status === "waiting_confirmation") {
      return {
        status: "waiting_confirmation",
        objective,
        tasks,
        evidence,
        replans,
        critique: { passed: false, reasons: ["Human confirmation is required before continuing the mission."] },
        memoryWritten: false,
        output: lastOutput,
      };
    }

    if (result.status !== "completed") {
      if (replans.length < maxReplans) {
        replans.push({
          reason: "Specialist task failed; mission stopped without unsafe fallback.",
          fromTask: task.id,
          toSkill: task.skillId,
        });
      }
      break;
    }
  }

  const critique = critiqueMission(evidence);
  const status: LiaMissionResult["status"] = critique.passed
    ? "completed"
    : replans.length > 0
      ? "partial"
      : "failed";

  return {
    status,
    objective,
    tasks,
    evidence,
    replans,
    critique,
    memoryWritten: false,
    output: lastOutput,
  };
}

export const runAutonomousMission = runLiaMission;
