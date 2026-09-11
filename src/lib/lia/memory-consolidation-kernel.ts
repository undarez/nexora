/**
 * NEXORA Memory Consolidation Kernel v1
 *
 * Converts reflection/learning signals into governed memory proposals.
 * This kernel never validates, mutates, or authorizes durable memory by itself.
 */
import type { NexoraReflectionResult } from "@/lib/lia/reflection-kernel";

export type ConsolidationDisposition = "propose" | "hold" | "quarantine" | "ignore";
export type MemoryCandidateKind = "lesson" | "strategy" | "behaviour" | "evidence_gap";

export type NexoraMemoryCandidate = {
  key: string;
  kind: MemoryCandidateKind;
  statement: string;
  confidence: number;
  disposition: ConsolidationDisposition;
  decayDays: number;
  conflictSensitive: boolean;
  provenance: { signal: string; qualityScore: number };
};

export type NexoraMemoryConsolidationResult = {
  version: 1;
  candidates: NexoraMemoryCandidate[];
  summary: { proposed: number; held: number; quarantined: number; ignored: number };
  authority: {
    durableMutationAuthorized: false;
    validationAuthorized: false;
    financialWriteAuthorized: false;
    memoryGovernanceAuthoritative: true;
  };
  invariants: string[];
};

const INVARIANTS = [
  "consolidation_never_validates_memory",
  "consolidation_never_mutates_authoritative_memory",
  "consolidation_never_authorizes_financial_write",
  "low_confidence_learning_is_held",
  "user_corrections_require_validation",
  "conflicts_are_quarantined",
  "provenance_is_preserved",
];

function clamp(n: number) { return Math.max(0, Math.min(1, n)); }

export function consolidateNexoraMemory(reflection: NexoraReflectionResult): NexoraMemoryConsolidationResult {
  const candidates: NexoraMemoryCandidate[] = [];
  const base = clamp(reflection.qualityScore / 100);

  for (const lesson of reflection.proposedLessons.slice(0, 6)) {
    const conflictSensitive = reflection.learningSignal === "clarification_pattern" || reflection.learningSignal === "failure_pattern";
    const confidence = Number(clamp(base * (reflection.learningSignal === "success_pattern" ? 0.9 : 0.65)).toFixed(3));
    let disposition: ConsolidationDisposition = confidence >= 0.7 ? "propose" : "hold";
    if (reflection.learningSignal === "failure_pattern" && confidence < 0.85) disposition = "hold";
    if (reflection.learningSignal === "clarification_pattern") disposition = "hold";

    candidates.push({
      key: `reflection:${reflection.learningSignal}:${Buffer.from(lesson).toString("base64url").slice(0, 64)}`,
      kind: reflection.learningSignal === "evidence_gap" ? "evidence_gap" : "lesson",
      statement: lesson.slice(0, 500),
      confidence,
      disposition,
      decayDays: reflection.learningSignal === "success_pattern" ? 90 : 30,
      conflictSensitive,
      provenance: { signal: reflection.learningSignal, qualityScore: reflection.qualityScore },
    });
  }

  if (reflection.learningSignal === "no_learning") {
    candidates.push({ key: "reflection:no_learning", kind: "lesson", statement: "Aucun apprentissage durable suffisamment étayé n'est proposé.", confidence: 0, disposition: "ignore", decayDays: 0, conflictSensitive: false, provenance: { signal: reflection.learningSignal, qualityScore: reflection.qualityScore } });
  }

  const summary = {
    proposed: candidates.filter(c => c.disposition === "propose").length,
    held: candidates.filter(c => c.disposition === "hold").length,
    quarantined: candidates.filter(c => c.disposition === "quarantine").length,
    ignored: candidates.filter(c => c.disposition === "ignore").length,
  };

  return {
    version: 1,
    candidates,
    summary,
    authority: { durableMutationAuthorized: false, validationAuthorized: false, financialWriteAuthorized: false, memoryGovernanceAuthoritative: true },
    invariants: INVARIANTS,
  };
}
