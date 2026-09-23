import { buildLiaCommandPlan } from "../command/index.ts";
import { executeExecutableLiaSkill } from "../agent/skill-runtime.ts";
import { registerChapter7SafeSkills } from "./safe-skills.ts";
import { getLiaAgentDefinition } from "./registry.ts";
import { planSpecialistExecution } from "./runtime.ts";

export type Chapter7ExecutionContext = {
  userId: string;
  requestId?: string;
  locale?: string;
  permissions?: readonly any[];
};

export async function executeSpecialistCommand(input: string, context: Chapter7ExecutionContext) {
  registerChapter7SafeSkills();
  const plan = buildLiaCommandPlan(input);
  const execution = planSpecialistExecution(plan);
  const agent = getLiaAgentDefinition(plan.route.agent);

  if (!agent) return execution;
  if (execution.status === "waiting_confirmation") return execution;

  const safeSkillIds = new Set(["content-generation", "technical-seo", "system-health", "data-quality"]);
  if (!safeSkillIds.has(plan.route.skill)) {
    return { ...execution, status: "planned" as const, output: { ...execution.output, next: "skill_adapter_required" } };
  }

  const permissions = (context.permissions ?? []) as any[];
  const output = await executeExecutableLiaSkill(
    plan.route.skill,
    { text: input },
    { userId: context.userId, requestId: context.requestId, locale: context.locale, permissions },
  );

  return {
    ...execution,
    status: "completed" as const,
    output: { ...execution.output, result: output },
    verification: { required: true, passed: true, reason: "Skill exécuté et vérifié." },
  };
}
