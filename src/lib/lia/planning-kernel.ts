/**
 * NEXORA Decision & Planning Kernel v1
 *
 * Converts the deterministic Reasoning Kernel output into a bounded,
 * auditable cognitive plan. It never executes tools, grants permissions,
 * or replaces the authoritative policy / Decision Gate.
 */
import type { ReasoningKernelResult } from "@/lib/lia/reasoning-kernel";

export type PlanningStepKind =
  | "collect_evidence"
  | "research"
  | "verify"
  | "analyze"
  | "clarify"
  | "recommend"
  | "human_gate";

export type PlanningStep = {
  order: number;
  kind: PlanningStepKind;
  objective: string;
  requiredEvidence: string[];
  blocking: boolean;
  automatic: boolean;
};

export type NexoraPlanningResult = {
  version: 1;
  status: "ready" | "needs_clarification" | "awaiting_human" | "blocked";
  objective: string;
  intent: ReasoningKernelResult["intent"];
  risk: ReasoningKernelResult["risk"];
  confidence: number;
  steps: PlanningStep[];
  bounded: {
    maxSteps: number;
    maxReplans: number;
    maxRetriesPerStep: number;
  };
  invariants: string[];
};

const INVARIANTS = [
  "planning_never_authorizes_financial_write",
  "policy_engine_remains_authoritative",
  "decision_gate_remains_authoritative",
  "external_facts_require_evidence",
  "memory_and_habits_are_context_not_authorization",
  "failed_verification_blocks_dependent_actions",
];

export function buildNexoraPlan(args: {
  objective: string;
  reasoning: ReasoningKernelResult;
}): NexoraPlanningResult {
  const { objective, reasoning } = args;
  const steps: PlanningStep[] = [];
  let order = 1;
  const add = (kind: PlanningStepKind, text: string, evidence: string[], blocking: boolean, automatic: boolean) => {
    if (steps.length >= 8) return;
    steps.push({ order: order++, kind, objective: text, requiredEvidence: evidence, blocking, automatic });
  };

  if (reasoning.missingEvidence.length > 0) {
    add("collect_evidence", "Rassembler ou vérifier les données nécessaires avant de conclure.", reasoning.missingEvidence, true, true);
  }
  if (reasoning.nextStep === "research" || reasoning.intent === "external_research") {
    add("research", "Acquérir les faits externes nécessaires auprès de sources contrôlées.", ["trusted_external_sources"], true, true);
    add("verify", "Évaluer les preuves externes, contradictions et limites avant utilisation.", ["trusted_external_sources"], true, true);
  }
  if (reasoning.nextStep === "clarify") {
    add("clarify", "Demander uniquement les informations indispensables pour lever l'ambiguïté.", [], true, false);
  }
  if (reasoning.intent !== "external_research" && reasoning.missingEvidence.length === 0) {
    add("analyze", "Analyser les données disponibles avec les règles financières déterministes de NEXORA.", reasoning.evidenceRequired, true, true);
  }
  if (reasoning.nextStep === "verify" && reasoning.missingEvidence.length === 0) {
    add("verify", "Vérifier les données critiques avant de produire une conclusion.", reasoning.evidenceRequired, true, true);
  }
  if (reasoning.risk === "high" || reasoning.risk === "critical" || reasoning.nextStep === "human_gate") {
    add("human_gate", "Présenter la proposition et attendre la validation humaine avant toute action sensible.", [], true, false);
  } else if (reasoning.nextStep !== "clarify") {
    add("recommend", "Formuler une recommandation explicable, bornée et vérifiable.", reasoning.evidenceRequired, false, true);
  }

  const status: NexoraPlanningResult["status"] =
    reasoning.nextStep === "clarify" ? "needs_clarification" :
    reasoning.nextStep === "human_gate" ? "awaiting_human" :
    reasoning.missingEvidence.length >= 2 ? "blocked" : "ready";

  return {
    version: 1,
    status,
    objective: objective.slice(0, 2000),
    intent: reasoning.intent,
    risk: reasoning.risk,
    confidence: reasoning.confidence,
    steps,
    bounded: { maxSteps: 8, maxReplans: 3, maxRetriesPerStep: 2 },
    invariants: INVARIANTS,
  };
}

export function nextPlannedStep(plan: NexoraPlanningResult): PlanningStep | null {
  return plan.steps.find((step) => step.blocking || step.kind === "recommend") ?? null;
}
