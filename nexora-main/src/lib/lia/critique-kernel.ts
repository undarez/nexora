/**
 * NEXORA Critique Kernel v1
 * Deterministic self-review layer. It can challenge a plan, request evidence,
 * or force clarification/replanning, but it never grants execution authority.
 */
import type { ReasoningKernelResult } from "@/lib/lia/reasoning-kernel";
import type { NexoraPlanningResult } from "@/lib/lia/planning-kernel";

export type CritiqueSeverity = "info" | "warning" | "blocking";
export type CritiqueFinding = { code: string; severity: CritiqueSeverity; message: string; remediation: string };
export type NexoraCritiqueResult = {
  version: 1;
  status: "accepted" | "revise" | "blocked";
  score: number;
  findings: CritiqueFinding[];
  requiredChanges: string[];
  invariants: string[];
};

const INVARIANTS = [
  "critique_never_authorizes_financial_write",
  "unsupported_external_facts_are_rejected",
  "missing_blocking_evidence_prevents_acceptance",
  "policy_engine_and_decision_gate_remain_authoritative",
  "memory_and_habits_are_not_authorization",
];

export function critiqueNexoraPlan(args: { reasoning: ReasoningKernelResult; plan: NexoraPlanningResult }): NexoraCritiqueResult {
  const { reasoning, plan } = args;
  const findings: CritiqueFinding[] = [];
  const requiredChanges: string[] = [];
  const hasKind = (kind: NexoraPlanningResult["steps"][number]["kind"]) => plan.steps.some((step) => step.kind === kind);
  const hasEvidenceCollection = hasKind("collect_evidence");

  if (reasoning.missingEvidence.length > 0 && !hasEvidenceCollection) {
    findings.push({ code: "MISSING_EVIDENCE_STEP", severity: "blocking", message: "Le raisonnement signale des preuves manquantes mais le plan ne prévoit pas leur collecte.", remediation: "Ajouter une étape de collecte des preuves avant toute conclusion." });
    requiredChanges.push("collect_missing_evidence");
  }
  if (reasoning.intent === "external_research" && (!hasKind("research") || !hasKind("verify"))) {
    findings.push({ code: "RESEARCH_NOT_VERIFIED", severity: "blocking", message: "Une recherche externe doit être suivie d'une vérification explicite.", remediation: "Ajouter recherche et vérification avant utilisation des faits externes." });
    requiredChanges.push("research_and_verify");
  }
  if ((reasoning.risk === "high" || reasoning.risk === "critical") && !hasKind("human_gate")) {
    findings.push({ code: "HUMAN_GATE_MISSING", severity: "blocking", message: "Le niveau de risque exige une validation humaine.", remediation: "Ajouter une étape human_gate avant toute action sensible." });
    requiredChanges.push("human_gate");
  }
  if (plan.steps.length === 0) {
    findings.push({ code: "EMPTY_PLAN", severity: "blocking", message: "Le plan ne contient aucune étape exploitable.", remediation: "Replanifier à partir du résultat du Reasoning Kernel." });
    requiredChanges.push("replan");
  }
  if (plan.steps.length > plan.bounded.maxSteps) {
    findings.push({ code: "PLAN_BOUND_EXCEEDED", severity: "blocking", message: "Le nombre d'étapes dépasse la borne déclarée.", remediation: "Réduire le plan à la borne maximale." });
    requiredChanges.push("bound_steps");
  }
  if (plan.invariants.includes("planning_never_authorizes_financial_write") === false) {
    findings.push({ code: "AUTHORITY_INVARIANT_MISSING", severity: "blocking", message: "L'invariant d'absence d'autorisation financière est absent.", remediation: "Restaurer l'invariant de gouvernance." });
    requiredChanges.push("restore_authority_invariant");
  }

  if (reasoning.confidence < 0.55 && plan.status === "ready") {
    findings.push({ code: "LOW_CONFIDENCE_READY", severity: "warning", message: "La confiance du raisonnement est faible pour un plan déclaré prêt.", remediation: "Renforcer les preuves ou demander une clarification." });
    requiredChanges.push("increase_evidence_or_clarify");
  }

  const blocking = findings.filter((f) => f.severity === "blocking").length;
  const score = Math.max(0, Math.min(1, 1 - blocking * 0.25 - findings.filter((f) => f.severity === "warning").length * 0.1));
  const status: NexoraCritiqueResult["status"] = blocking > 0 ? "blocked" : findings.length > 0 ? "revise" : "accepted";
  return { version: 1, status, score, findings, requiredChanges, invariants: INVARIANTS };
}
