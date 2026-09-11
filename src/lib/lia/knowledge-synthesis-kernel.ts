/**
 * NEXORA Knowledge Synthesis Kernel v1
 *
 * Combines independently sourced evidence into a bounded knowledge candidate.
 * It preserves provenance, grades support, surfaces conflicts and never turns
 * synthesis into truth, durable memory, tool execution or financial authority.
 */
export type SynthesisEvidence = {
  id: string;
  statement: string;
  source: string;
  quality: number;      // 0..100
  freshness: number;    // 0..100
  independence?: number; // 0..100
  supports?: boolean;
};

export type KnowledgeSynthesisStatus = "supported" | "tentative" | "conflicted" | "insufficient";

export type NexoraKnowledgeSynthesisResult = {
  version: 1;
  status: KnowledgeSynthesisStatus;
  synthesis: string | null;
  confidence: number;
  evidence: SynthesisEvidence[];
  conflicts: string[];
  alternatives: string[];
  provenance: { evidenceIds: string[]; sources: string[] };
  nextStep: "proceed_to_verification" | "reconcile_conflict" | "collect_more_evidence" | "hold";
  authority: {
    createsFacts: false;
    validatesTruth: false;
    mutatesMemory: false;
    executesTools: false;
    authorizesFinancialWrite: false;
    memoryGovernanceAuthoritative: true;
    decisionGateAuthoritative: true;
  };
  invariants: string[];
};

const INVARIANTS = [
  "synthesis_is_not_truth", "provenance_is_preserved", "independent_evidence_is_preferred",
  "conflicts_are_explicit", "insufficient_evidence_is_not_invented", "synthesis_never_mutates_memory",
  "synthesis_never_executes_tools", "synthesis_never_authorizes_financial_write",
  "memory_governance_remains_authoritative", "decision_gate_remains_authoritative",
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function synthesizeNexoraKnowledge(args: {
  question: string;
  evidence: SynthesisEvidence[];
  alternatives?: string[];
}): NexoraKnowledgeSynthesisResult {
  const evidence = args.evidence.slice(0, 12).map(e => ({ ...e, quality: clamp(e.quality), freshness: clamp(e.freshness), independence: clamp(e.independence ?? 50), supports: e.supports !== false }));
  const supporting = evidence.filter(e => e.supports);
  const opposing = evidence.filter(e => e.supports === false);
  const conflicts: string[] = [];
  if (supporting.length && opposing.length) conflicts.push("supporting_and_opposing_evidence_present");
  const distinctSources = new Set(evidence.map(e => e.source)).size;
  const avg = evidence.length ? evidence.reduce((s, e) => s + e.quality * 0.5 + e.freshness * 0.2 + (e.independence ?? 50) * 0.3, 0) / evidence.length : 0;
  const independenceBonus = Math.min(15, Math.max(0, distinctSources - 1) * 5);
  const confidence = clamp(avg + independenceBonus - (conflicts.length ? 25 : 0));

  let status: KnowledgeSynthesisStatus = "insufficient";
  if (conflicts.length) status = "conflicted";
  else if (supporting.length >= 2 && confidence >= 70) status = "supported";
  else if (supporting.length >= 1 && confidence >= 45) status = "tentative";

  const synthesis = status === "insufficient" ? null :
    status === "conflicted" ? `Les éléments disponibles sur « ${args.question.trim().slice(0, 180)} » sont contradictoires et nécessitent une réconciliation.` :
    `Les éléments disponibles apportent un support ${status === "supported" ? "convergent" : "partiel"} à l'hypothèse étudiée, avec un niveau de confiance de ${confidence}/100.`;

  let nextStep: NexoraKnowledgeSynthesisResult["nextStep"] = "hold";
  if (status === "supported") nextStep = "proceed_to_verification";
  else if (status === "tentative") nextStep = "collect_more_evidence";
  else if (status === "conflicted") nextStep = "reconcile_conflict";
  else nextStep = "collect_more_evidence";

  return {
    version: 1, status, synthesis, confidence,
    evidence, conflicts, alternatives: (args.alternatives ?? []).slice(0, 6),
    provenance: { evidenceIds: evidence.map(e => e.id), sources: [...new Set(evidence.map(e => e.source))] },
    nextStep,
    authority: { createsFacts: false, validatesTruth: false, mutatesMemory: false, executesTools: false, authorizesFinancialWrite: false, memoryGovernanceAuthoritative: true, decisionGateAuthoritative: true },
    invariants: INVARIANTS,
  };
}
