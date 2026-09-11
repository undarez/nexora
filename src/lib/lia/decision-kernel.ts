/**
 * NEXORA Decision Kernel v1
 *
 * Converts the outputs of Reasoning, Planning and Critique into a bounded
 * cognitive disposition. This kernel never grants financial authority and
 * never executes tools. The authoritative Policy Engine / Decision Gate still
 * controls any sensitive action.
 */
import type { NexoraCritiqueResult } from "@/lib/lia/critique-kernel";
import type { NexoraPlanningResult } from "@/lib/lia/planning-kernel";
import type { ReasoningKernelResult } from "@/lib/lia/reasoning-kernel";

export type NexoraDecisionDisposition =
  | "proceed"
  | "research_required"
  | "clarification_required"
  | "human_validation_required"
  | "replan_required"
  | "blocked";

export type NexoraDecisionKernelResult = {
  version: 1;
  disposition: NexoraDecisionDisposition;
  confidence: number;
  rationale: string[];
  blockingConditions: string[];
  nextOperation: "answer" | "research" | "clarify" | "replan" | "human_gate" | "stop";
  authority: {
    financialWriteAuthorized: false;
    policyEngineAuthoritative: true;
    decisionGateAuthoritative: true;
  };
  invariants: string[];
};

const INVARIANTS = [
  "decision_kernel_never_authorizes_financial_write",
  "policy_engine_remains_authoritative",
  "decision_gate_remains_authoritative",
  "critique_block_prevents_proceed",
  "missing_external_evidence_prevents_external_fact_claim",
  "memory_and_habits_are_context_not_authorization",
];

export function runNexoraDecisionKernel(args: {
  reasoning: ReasoningKernelResult;
  planning: NexoraPlanningResult;
  critique: NexoraCritiqueResult;
  externalResearchAvailable?: boolean;
}): NexoraDecisionKernelResult {
  const { reasoning, planning, critique } = args;
  const rationale: string[] = [];
  const blockingConditions: string[] = [];

  if (critique.status === "blocked") {
    blockingConditions.push("critique_blocked_plan");
    rationale.push("La critique déterministe a identifié au moins une condition bloquante.");
  }

  if (reasoning.missingEvidence.length > 0) {
    blockingConditions.push("missing_required_evidence");
    rationale.push("Des preuves nécessaires au raisonnement restent manquantes.");
  }

  if (reasoning.intent === "external_research" && !args.externalResearchAvailable) {
    blockingConditions.push("external_research_not_available");
    rationale.push("Une information externe contrôlée est nécessaire mais n'est pas disponible dans ce tour.");
  }

  if (planning.status === "needs_clarification" || reasoning.nextStep === "clarify") {
    return {
      version: 1,
      disposition: "clarification_required",
      confidence: Math.min(reasoning.confidence, 80),
      rationale: [...rationale, "Le contexte ne permet pas de poursuivre sans précision utilisateur."],
      blockingConditions,
      nextOperation: "clarify",
      authority: { financialWriteAuthorized: false, policyEngineAuthoritative: true, decisionGateAuthoritative: true },
      invariants: INVARIANTS,
    };
  }

  if (reasoning.nextStep === "human_gate" || planning.status === "awaiting_human") {
    return {
      version: 1,
      disposition: "human_validation_required",
      confidence: Math.min(reasoning.confidence, 85),
      rationale: [...rationale, "Le niveau de risque impose une validation humaine avant toute action sensible."],
      blockingConditions,
      nextOperation: "human_gate",
      authority: { financialWriteAuthorized: false, policyEngineAuthoritative: true, decisionGateAuthoritative: true },
      invariants: INVARIANTS,
    };
  }

  if (critique.status === "blocked") {
    return {
      version: 1,
      disposition: "replan_required",
      confidence: Math.min(reasoning.confidence, 70),
      rationale: [...rationale, "Le plan doit être corrigé avant de poursuivre."],
      blockingConditions,
      nextOperation: "replan",
      authority: { financialWriteAuthorized: false, policyEngineAuthoritative: true, decisionGateAuthoritative: true },
      invariants: INVARIANTS,
    };
  }

  if (reasoning.intent === "external_research" && !args.externalResearchAvailable) {
    return {
      version: 1,
      disposition: "research_required",
      confidence: Math.min(reasoning.confidence, 75),
      rationale: [...rationale, "La réponse doit attendre une recherche externe contrôlée."],
      blockingConditions,
      nextOperation: "research",
      authority: { financialWriteAuthorized: false, policyEngineAuthoritative: true, decisionGateAuthoritative: true },
      invariants: INVARIANTS,
    };
  }

  if (blockingConditions.length > 0) {
    return {
      version: 1,
      disposition: "blocked",
      confidence: Math.min(reasoning.confidence, 65),
      rationale: [...rationale, "Une condition cognitive bloquante empêche une conclusion fiable."],
      blockingConditions,
      nextOperation: "stop",
      authority: { financialWriteAuthorized: false, policyEngineAuthoritative: true, decisionGateAuthoritative: true },
      invariants: INVARIANTS,
    };
  }

  return {
    version: 1,
    disposition: "proceed",
    confidence: Math.min(99, Math.max(60, Math.round((reasoning.confidence + critique.score * 100) / 2))),
    rationale: ["Le raisonnement, le plan et la critique ne présentent pas de blocage cognitif."],
    blockingConditions: [],
    nextOperation: "answer",
    authority: { financialWriteAuthorized: false, policyEngineAuthoritative: true, decisionGateAuthoritative: true },
    invariants: INVARIANTS,
  };
}
