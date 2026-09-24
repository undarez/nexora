import { executeSpecialistCommand } from "./executor.ts";
import type { LiaMissionOptions, LiaMissionResult, LiaMissionTask } from "./supervisor-types.ts";

function taskFromInput(input: string): LiaMissionTask {
  return {
    id: "mission-task-1",
    intent: input,
    input,
    agentId: "finance",
    skillId: "finance-analytics",
    dependsOn: [],
  };
}

export async function runLiaMission(
  objective: string,
  context: { userId: string; requestId?: string; locale?: string },
  options: LiaMissionOptions = {},
): Promise<LiaMissionResult> {
  const task = taskFromInput(objective);
  const evidence: LiaMissionResult["evidence"] = [];
  const replans: LiaMissionResult["replans"] = [];

  if (options.maxSteps === 0) {
    return {
      status: "failed",
      objective,
      tasks: [task],
      evidence: [],
      replans,
      critique: { passed: false, reasons: ["Mission budget exhausted before execution."] },
      memoryWritten: false,
      output: { error: "mission_budget_exhausted" },
    };
  }

  const result = await executeSpecialistCommand(objective, context);
  evidence.push({
    taskId: task.id,
    agentId: task.agentId,
    skillId: task.skillId,
    status: result.status,
    verification: result.verification,
    output: result.output,
  });

  const passed = result.status === "completed";
  return {
    status: passed ? "completed" : result.status === "waiting_confirmation" ? "waiting_confirmation" : "failed",
    objective,
    tasks: [task],
    evidence,
    replans,
    critique: {
      passed,
      reasons: passed ? ["Mission execution completed."] : ["Mission execution did not complete."],
    },
    memoryWritten: false,
    output: result.output,
  };
}

export const runAutonomousMission = runLiaMission;
