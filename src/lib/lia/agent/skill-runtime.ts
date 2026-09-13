import type { LiaPermission, LiaRiskClass } from "@/lib/lia/skills/types";

export type ExecutableLiaSkill<TInput = unknown, TOutput = unknown> = {
  id: string;
  name: string;
  description: string;
  capabilities: readonly string[];
  requiredPermissions: readonly LiaPermission[];
  riskClass: LiaRiskClass;
  execute: (input: TInput, context: LiaSkillExecutionContext) => Promise<TOutput>;
  verify?: (output: TOutput, context: LiaSkillExecutionContext) => Promise<{ ok: boolean; reason?: string }>;
};

export type LiaSkillExecutionContext = {
  userId: string;
  requestId?: string;
  locale?: string;
  permissions: readonly LiaPermission[];
};

// Runtime registry intentionally erases individual skill input/output types.
// Each registered skill retains its own generic contract at execution time.
const registry = new Map<string, ExecutableLiaSkill<any, any>>();

export function registerExecutableLiaSkill<TInput, TOutput>(skill: ExecutableLiaSkill<TInput, TOutput>): void {
  if (registry.has(skill.id)) throw new Error(`Skill déjà enregistré : ${skill.id}`);
  registry.set(skill.id, skill);
}

export function getExecutableLiaSkill(id: string): ExecutableLiaSkill<any, any> | null {
  return registry.get(id) ?? null;
}

export function listExecutableLiaSkills(): ExecutableLiaSkill<any, any>[] {
  return [...registry.values()];
}

export function canExecuteLiaSkill(skill: ExecutableLiaSkill<any, any>, permissions: readonly LiaPermission[]): boolean {
  return skill.requiredPermissions.every(permission => permissions.includes(permission));
}

export async function executeExecutableLiaSkill<TInput, TOutput>(
  id: string,
  input: TInput,
  context: LiaSkillExecutionContext,
): Promise<TOutput> {
  const skill = getExecutableLiaSkill(id) as ExecutableLiaSkill<TInput, TOutput> | null;
  if (!skill) throw new Error(`Skill introuvable : ${id}`);
  if (!canExecuteLiaSkill(skill, context.permissions)) {
    throw new Error(`Permission insuffisante pour le Skill : ${id}`);
  }
  const output = await skill.execute(input, context);
  if (skill.verify) {
    const verification = await skill.verify(output, context);
    if (!verification.ok) throw new Error(verification.reason || `Vérification échouée : ${id}`);
  }
  return output;
}
