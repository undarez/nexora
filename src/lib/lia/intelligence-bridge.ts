/**
 * Chapter 5 Intelligence Bridge.
 * Composes cognitive, budget and skill intelligence as bounded context.
 * This module never grants permissions or performs financial writes.
 */
import { routeBudgetIntelligenceLayers, BUDGET_INTELLIGENCE_INVARIANTS } from "@/lib/lia/budget-intelligence";
import { recommendSkillBlueprints, skillIntelligenceInvariants } from "@/lib/lia/skill-intelligence";

export function buildLiaIntelligenceBridge(question: string, cognitive: Record<string, unknown> | null = null) {
  const budgetLayers = routeBudgetIntelligenceLayers(question);
  const skills = recommendSkillBlueprints(question, 8).map((skill) => ({
    slug: skill.slug,
    name: skill.name,
    layer: skill.layer,
    riskClass: skill.riskClass,
    activationPolicy: skill.activationPolicy,
  }));
  return {
    version: "5.16.00",
    cognitive: cognitive ?? null,
    budget: { layers: budgetLayers, invariants: BUDGET_INTELLIGENCE_INVARIANTS },
    skills: { selected: skills, invariants: skillIntelligenceInvariants() },
    authority: {
      toolExecutionAuthorized: false,
      financialWriteAuthorized: false,
      memoryMutationAuthorized: false,
      productionSkillChanges: 0,
      humanGateRequiredForFinancialWrites: true,
    },
  } as const;
}

export function buildLiaIntelligenceBridgePrompt(question: string, cognitive: Record<string, unknown> | null = null) {
  return `\n\nNEXORA INTELLIGENCE BRIDGE:\n${JSON.stringify(buildLiaIntelligenceBridge(question, cognitive))}\nRègle : les couches cognitives, budgétaires et Skills décrivent le contexte et les capacités candidates ; elles ne constituent jamais une permission d'action. Les écritures financières et changements de production restent soumis aux politiques et gates d'autorisation.`;
}
