import type { LiaCommandPlan } from "@/lib/lia/command/types.ts";
import { getLiaAgentDefinition } from "./registry.ts";
import type { LiaAgentRunResult, LiaAgentStep, LiaSpecialistId } from "./types.ts";

function buildStep(agentId: LiaSpecialistId, skillId: string, requiresConfirmation: boolean): LiaAgentStep {
  return {
    id: agentId + ":" + skillId,
    agentId,
    skillId,
    purpose: "Exécuter le skill " + skillId + " dans le périmètre de l'agent " + agentId + ".",
    status: requiresConfirmation ? "waiting_confirmation" : "planned",
    requiresConfirmation,
    verificationRequired: true,
  };
}

export function planSpecialistExecution(plan: LiaCommandPlan): LiaAgentRunResult {
  const agentId = plan.route.agent;
  const agent = getLiaAgentDefinition(agentId);

  if (!agent) {
    return {
      status: "failed",
      agent: {
        id: "data",
        label: "Unknown",
        purpose: "Agent non disponible.",
        skills: [],
        permissions: [],
        maxSteps: 1,
        maxRetriesPerStep: 0,
        autonomyLevel: 0,
        requiresHumanApprovalFor: ["write", "critical"],
        verifyRequired: true,
      },
      steps: [],
      output: { error: "specialist_agent_not_found", route: agentId },
      verification: { required: true, passed: false, reason: "Agent spécialisé introuvable." },
    };
  }

  const requiresConfirmation = plan.policy.requiresConfirmation || plan.policy.mode === "critical";
  const step = buildStep(agent.id, plan.route.skill, requiresConfirmation);

  return {
    status: requiresConfirmation ? "waiting_confirmation" : "planned",
    agent,
    steps: [step],
    output: {
      intent: plan.intent.intent,
      parameters: plan.intent.parameters,
      confidence: plan.intent.confidence,
      risk: plan.policy.risk,
      mode: plan.policy.mode,
      next: requiresConfirmation ? "human_confirmation_required" : "execute_skill",
    },
    verification: {
      required: agent.verifyRequired,
      passed: null,
      reason: "Le résultat doit être vérifié après exécution du skill.",
    },
  };
}

export function assertSpecialistCanRun(plan: LiaCommandPlan, options?: { permissions?: readonly LiaPermission[]; userAutonomyLevel?: number; budgetRemaining?: number }): void {
  const agent = getLiaAgentDefinition(plan.route.agent);
  if (!agent) throw new Error("Agent spécialisé introuvable : " + plan.route.agent);
  if (!agent.skills.includes(plan.route.skill)) {
    throw new Error("Skill " + plan.route.skill + " non autorisé pour " + agent.id);
  }
  if (plan.intent.confidence < 70) {
    throw new Error("Confiance insuffisante pour lancer un agent spécialisé.");
  }
  if (plan.policy.requiresConfirmation) {
    throw new Error("Confirmation humaine requise avant exécution.");
  }
}
