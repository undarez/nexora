/**
 * NEXORA Unified Cognitive Loop v1
 *
 * Composes the deterministic cognitive kernels into one bounded pipeline.
 * The loop coordinates cognition; it never grants authority or executes
 * financial writes. Policy Engine and Decision Gate remain sovereign.
 */
import { runReasoningKernel, type ReasoningKernelInput, type ReasoningKernelResult } from "@/lib/lia/reasoning-kernel";
import { buildNexoraPlan, type NexoraPlanningResult } from "@/lib/lia/planning-kernel";
import { critiqueNexoraPlan, type NexoraCritiqueResult } from "@/lib/lia/critique-kernel";
import { runNexoraDecisionKernel, type NexoraDecisionKernelResult } from "@/lib/lia/decision-kernel";
import { runNexoraEpistemicKernel, type NexoraEpistemicResult, type NexoraEpistemicClaim } from "@/lib/lia/epistemic-kernel";
import { runNexoraCausalKernel, type NexoraCausalResult } from "@/lib/lia/causal-kernel";
import { runNexoraScenarioKernel, type NexoraScenarioResult } from "@/lib/lia/scenario-kernel";
import { runNexoraInquiryKernel, type NexoraInquiryResult } from "@/lib/lia/inquiry-kernel";
import { synthesizeNexoraKnowledge, type NexoraKnowledgeSynthesisResult, type SynthesisEvidence } from "@/lib/lia/knowledge-synthesis-kernel";
import { buildNexoraTemporalWorldModel, type TemporalStatus } from "@/lib/lia/temporal-world-model-kernel";
import type { KnowledgeEdge, KnowledgeNode } from "@/lib/lia/knowledge-graph";
import { runNexoraReflectionKernel, type NexoraReflectionResult, type NexoraReflectionOutcome } from "@/lib/lia/reflection-kernel";
import { consolidateNexoraMemory, type NexoraMemoryConsolidationResult } from "@/lib/lia/memory-consolidation-kernel";

export type UnifiedCognitiveLoopInput = {
  reasoning: ReasoningKernelInput;
  objective?: string;
  externalResearchAvailable?: boolean;
  synthesisEvidence?: SynthesisEvidence[];
  knowledgeNodes?: KnowledgeNode[];
  knowledgeEdges?: KnowledgeEdge[];
  causalHypotheses?: Parameters<typeof runNexoraCausalKernel>[0]["hypotheses"];
  scenarios?: Parameters<typeof runNexoraScenarioKernel>[0]["scenarios"];
  inquiries?: Parameters<typeof runNexoraInquiryKernel>[0]["inquiries"];
  outcome?: NexoraReflectionOutcome;
  evidenceVerified?: boolean;
  userCorrection?: boolean;
  executionError?: string | null;
  precomputed?: {
    reasoning?: ReasoningKernelResult;
    planning?: NexoraPlanningResult;
    critique?: NexoraCritiqueResult;
    decision?: NexoraDecisionKernelResult;
  };
};

export type UnifiedCognitiveLoopResult = {
  version: 1;
  status: "proceed" | "clarify" | "research" | "verify" | "reconcile" | "replan" | "human_gate" | "blocked";
  stages: {
    reasoning: ReasoningKernelResult;
    planning: NexoraPlanningResult;
    critique: NexoraCritiqueResult;
    epistemic: NexoraEpistemicResult;
    causal: NexoraCausalResult;
    scenarios: NexoraScenarioResult;
    inquiry: NexoraInquiryResult;
    knowledge: NexoraKnowledgeSynthesisResult;
    temporalWorldModel: ReturnType<typeof buildNexoraTemporalWorldModel>;
    decision: NexoraDecisionKernelResult;
    reflection: NexoraReflectionResult;
    consolidation: NexoraMemoryConsolidationResult;
  };
  nextAction: string;
  authority: {
    financialWriteAuthorized: false;
    toolExecutionAuthorized: false;
    memoryMutationAuthorized: false;
    policyEngineAuthoritative: true;
    decisionGateAuthoritative: true;
  };
  invariants: string[];
};

const INVARIANTS = [
  "unified_loop_is_deterministic_and_bounded",
  "reasoning_planning_critique_decision_are_composed_not_overridden",
  "epistemic_causal_scenario_outputs_are_advisory_cognitive_constraints",
  "knowledge_synthesis_and_world_model_do_not_activate_truth",
  "reflection_and_consolidation_do_not_mutate_authoritative_memory",
  "financial_writes_require_policy_and_decision_gate",
  "language_engine_is_not_the_cognitive_authority",
];

function defaultInquiries(input: UnifiedCognitiveLoopInput, reasoning: ReasoningKernelResult) {
  const inquiries: Parameters<typeof runNexoraInquiryKernel>[0]["inquiries"] = [];
  if (reasoning.missingEvidence.length > 0) {
    inquiries.push({
      id: "missing-evidence",
      kind: "verification",
      question: `Vérifier les éléments manquants: ${reasoning.missingEvidence.join(", ")}`,
      targetUncertainty: reasoning.missingEvidence.join(", "),
      expectedDecisionImpact: 90,
      evidenceQuality: 80,
      effort: 30,
      urgency: reasoning.signals.includes("urgency_signal") ? 90 : 50,
      prerequisites: [],
    });
  }
  if (reasoning.intent === "external_research" || input.externalResearchAvailable === false) {
    inquiries.push({
      id: "external-research",
      kind: "research",
      question: "Rechercher les faits externes nécessaires auprès de sources contrôlées.",
      targetUncertainty: "external_facts",
      expectedDecisionImpact: 95,
      evidenceQuality: 90,
      effort: 45,
      urgency: reasoning.signals.includes("urgency_signal") ? 90 : 60,
      prerequisites: [],
    });
  }
  if (reasoning.nextStep === "clarify") {
    inquiries.push({
      id: "clarification",
      kind: "clarification",
      question: "Préciser l'objectif ou la donnée indispensable à la résolution.",
      targetUncertainty: "user_intent_or_missing_context",
      expectedDecisionImpact: 95,
      evidenceQuality: 100,
      effort: 10,
      urgency: 70,
      prerequisites: [],
    });
  }
  return inquiries.length ? inquiries : [{
    id: "verification-default",
    kind: "verification" as const,
    question: "Vérifier les éléments critiques avant conclusion.",
    targetUncertainty: "critical_evidence",
    expectedDecisionImpact: 70,
    evidenceQuality: 80,
    effort: 25,
    urgency: 50,
    prerequisites: [],
  }];
}

function defaultEpistemicClaims(reasoning: ReasoningKernelResult, knowledge: NexoraKnowledgeSynthesisResult): NexoraEpistemicClaim[] {
  return [
    {
      key: "intent",
      kind: "inference",
      statement: `Intention détectée: ${reasoning.intent}`,
      status: reasoning.confidence >= 80 ? "probable" : "unknown",
      confidence: reasoning.confidence,
      requiresEvidence: false,
      requiresUserConfirmation: reasoning.nextStep === "clarify",
      sourceCount: 1,
    },
    {
      key: "knowledge-synthesis",
      kind: "inference",
      statement: knowledge.synthesis ?? "Aucune synthèse suffisamment étayée.",
      status: knowledge.status === "supported" ? "probable" : knowledge.status === "conflicted" ? "conflicted" : "unknown",
      confidence: knowledge.confidence,
      requiresEvidence: knowledge.status !== "supported",
      requiresUserConfirmation: false,
      sourceCount: knowledge.provenance.sources.length,
    },
  ];
}

export function runUnifiedCognitiveLoop(input: UnifiedCognitiveLoopInput): UnifiedCognitiveLoopResult {
  const reasoning = input.precomputed?.reasoning ?? runReasoningKernel(input.reasoning);
  const planning = input.precomputed?.planning ?? buildNexoraPlan({ objective: input.objective ?? input.reasoning.question, reasoning });
  const critique = input.precomputed?.critique ?? critiqueNexoraPlan({ reasoning, plan: planning });

  const synthesis = synthesizeNexoraKnowledge({
    question: input.reasoning.question,
    evidence: (input.synthesisEvidence ?? []).slice(0, 12),
    alternatives: reasoning.signals,
  });
  const epistemic = runNexoraEpistemicKernel({ claims: defaultEpistemicClaims(reasoning, synthesis) });

  const causal = runNexoraCausalKernel({ hypotheses: input.causalHypotheses ?? [] });
  const causalSupport = causal.hypotheses.length === 0 ? 0 : Math.max(...causal.hypotheses.map((h) => h.confidence));
  const scenarios = runNexoraScenarioKernel({
    scenarios: input.scenarios ?? [{ id: "baseline", mode: "baseline", premise: input.reasoning.question, assumptions: [], uncertainty: [], causalSupport }],
    causalSupport,
  });
  const inquiry = runNexoraInquiryKernel({ inquiries: input.inquiries ?? defaultInquiries(input, reasoning), maxResults: 4 });

  const nodes = input.knowledgeNodes ?? [];
  const temporalWorldModel = buildNexoraTemporalWorldModel(nodes, input.knowledgeEdges ?? []);

  const decision = input.precomputed?.decision ?? runNexoraDecisionKernel({
    reasoning,
    planning,
    critique,
    externalResearchAvailable: input.externalResearchAvailable,
  });

  let status: UnifiedCognitiveLoopResult["status"] = "proceed";
  if (decision.disposition === "clarification_required") status = "clarify";
  else if (decision.disposition === "research_required") status = "research";
  else if (decision.disposition === "human_validation_required") status = "human_gate";
  else if (decision.disposition === "replan_required") status = "replan";
  else if (decision.disposition === "blocked") status = "blocked";
  else if (epistemic.nextStep === "reconcile" || causal.nextStep === "reconcile" || synthesis.nextStep === "reconcile_conflict") status = "reconcile";
  else if (epistemic.nextStep === "verify" || causal.nextStep === "verify" || synthesis.nextStep === "collect_more_evidence") status = "verify";

  const reflection = runNexoraReflectionKernel({
    decision,
    outcome: input.outcome ?? (status === "proceed" ? "completed" : status === "human_gate" ? "awaiting_human" : status === "blocked" ? "blocked" : "partially_completed"),
    evidenceVerified: input.evidenceVerified,
    userCorrection: input.userCorrection,
    executionError: input.executionError,
  });
  const consolidation = consolidateNexoraMemory(reflection);

  const nextAction = status === "clarify" ? "demander une clarification" :
    status === "research" ? "effectuer la recherche contrôlée" :
    status === "verify" ? "vérifier les preuves critiques" :
    status === "reconcile" ? "réconcilier les éléments contradictoires" :
    status === "replan" ? "replanifier" :
    status === "human_gate" ? "attendre la validation humaine" :
    status === "blocked" ? "arrêter le parcours" : "poursuivre avec la prochaine étape planifiée";

  return {
    version: 1,
    status,
    stages: { reasoning, planning, critique, epistemic, causal, scenarios, inquiry, knowledge: synthesis, temporalWorldModel, decision, reflection, consolidation },
    nextAction,
    authority: {
      financialWriteAuthorized: false,
      toolExecutionAuthorized: false,
      memoryMutationAuthorized: false,
      policyEngineAuthoritative: true,
      decisionGateAuthoritative: true,
    },
    invariants: INVARIANTS,
  };
}

export function summarizeUnifiedCognitiveLoop(result: UnifiedCognitiveLoopResult) {
  const temporal = result.stages.temporalWorldModel.temporal;
  return {
    version: result.version,
    status: result.status,
    nextAction: result.nextAction,
    intent: result.stages.reasoning.intent,
    risk: result.stages.reasoning.risk,
    confidence: result.stages.decision.confidence,
    critique: result.stages.critique.status,
    epistemic: result.stages.epistemic.overallStatus,
    causal: result.stages.causal.nextStep,
    knowledge: result.stages.knowledge.status,
    inquiry: result.stages.inquiry.nextStep,
    temporal: {
      current: temporal.currentNodeIds.length,
      future: temporal.futureNodeIds.length,
      expired: temporal.expiredNodeIds.length,
      undated: temporal.undatedNodeIds.length,
    } satisfies Record<TemporalStatus, number>,
    authority: result.authority,
  };
}
