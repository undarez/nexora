/**
 * NEXORA Reflection & Learning Kernel v1
 *
 * Evaluates an execution outcome after a cognitive decision. It proposes
 * bounded learning signals but never mutates memory, grants authority, or
 * executes tools. Durable learning must still pass the existing governance
 * and memory-curation pipeline.
 */
import type { NexoraDecisionKernelResult } from "@/lib/lia/decision-kernel";

export type NexoraReflectionOutcome =
  | "completed"
  | "partially_completed"
  | "failed"
  | "blocked"
  | "awaiting_human"
  | "cancelled";

export type NexoraLearningSignal =
  | "success_pattern"
  | "failure_pattern"
  | "evidence_gap"
  | "clarification_pattern"
  | "replan_pattern"
  | "human_gate_pattern"
  | "no_learning";

export type NexoraReflectionResult = {
  version: 1;
  outcome: NexoraReflectionOutcome;
  qualityScore: number;
  learningSignal: NexoraLearningSignal;
  observations: string[];
  proposedLessons: string[];
  nextAdjustment: "none" | "improve_evidence" | "improve_clarity" | "improve_plan" | "review_governance";
  authority: {
    memoryMutationAuthorized: false;
    financialWriteAuthorized: false;
    policyEngineAuthoritative: true;
    decisionGateAuthoritative: true;
  };
  invariants: string[];
};

const INVARIANTS = [
  "reflection_never_mutates_memory",
  "reflection_never_authorizes_financial_write",
  "learning_signal_is_not_authorization",
  "policy_engine_remains_authoritative",
  "decision_gate_remains_authoritative",
  "lessons_require_governed_persistence",
];

export function runNexoraReflectionKernel(args: {
  decision: NexoraDecisionKernelResult;
  outcome: NexoraReflectionOutcome;
  evidenceVerified?: boolean;
  userCorrection?: boolean;
  executionError?: string | null;
}): NexoraReflectionResult {
  const { decision, outcome } = args;
  const observations: string[] = [];
  const proposedLessons: string[] = [];

  if (outcome === "completed" && args.evidenceVerified !== false) {
    observations.push("Le parcours cognitif a atteint son terme sans échec déclaré.");
    proposedLessons.push("Conserver la séquence cognitive si elle reste pertinente dans des cas comparables.");
  }

  if (outcome === "failed") {
    observations.push("Le parcours n'a pas atteint son résultat attendu.");
    proposedLessons.push("Identifier la première étape déterministe ayant divergé avant toute adaptation durable.");
  }

  if (outcome === "blocked") {
    observations.push("Le système a correctement interrompu le parcours sur une condition bloquante.");
    proposedLessons.push("Conserver le blocage comme signal de sûreté, pas comme erreur d'apprentissage.");
  }

  if (outcome === "awaiting_human") {
    observations.push("Une validation humaine reste nécessaire.");
    proposedLessons.push("Évaluer si la préparation en amont pourrait rendre la prochaine validation plus informative.");
  }

  if (decision.disposition === "clarification_required") {
    observations.push("Une clarification utilisateur a été nécessaire.");
  }

  if (decision.disposition === "research_required") {
    observations.push("Une preuve externe contrôlée était nécessaire.");
  }

  if (decision.disposition === "replan_required") {
    observations.push("Le plan initial nécessitait une révision.");
  }

  if (args.evidenceVerified === false) {
    observations.push("Les preuves n'ont pas été suffisamment vérifiées.");
    proposedLessons.push("Renforcer la collecte ou la vérification des preuves avant conclusion.");
  }

  if (args.userCorrection) {
    observations.push("Une correction utilisateur a été fournie.");
    proposedLessons.push("Traiter la correction comme un signal à valider avant de modifier une mémoire durable.");
  }

  if (args.executionError) {
    observations.push(`Une erreur d'exécution a été observée: ${args.executionError.slice(0, 180)}`);
  }

  let learningSignal: NexoraLearningSignal = "no_learning";
  let nextAdjustment: NexoraReflectionResult["nextAdjustment"] = "none";

  if (args.evidenceVerified === false) {
    learningSignal = "evidence_gap";
    nextAdjustment = "improve_evidence";
  } else if (args.userCorrection) {
    learningSignal = "clarification_pattern";
    nextAdjustment = "improve_clarity";
  } else if (decision.disposition === "replan_required") {
    learningSignal = "replan_pattern";
    nextAdjustment = "improve_plan";
  } else if (decision.disposition === "human_validation_required") {
    learningSignal = "human_gate_pattern";
    nextAdjustment = "review_governance";
  } else if (outcome === "failed") {
    learningSignal = "failure_pattern";
  } else if (outcome === "completed") {
    learningSignal = "success_pattern";
  }

  const qualityBase = outcome === "completed" ? 90 : outcome === "partially_completed" ? 70 : outcome === "blocked" ? 80 : 45;
  const qualityScore = Math.max(0, Math.min(100, qualityBase - (args.evidenceVerified === false ? 25 : 0) - (args.executionError ? 15 : 0)));

  return {
    version: 1,
    outcome,
    qualityScore,
    learningSignal,
    observations,
    proposedLessons,
    nextAdjustment,
    authority: {
      memoryMutationAuthorized: false,
      financialWriteAuthorized: false,
      policyEngineAuthoritative: true,
      decisionGateAuthoritative: true,
    },
    invariants: INVARIANTS,
  };
}
