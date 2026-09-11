/**
 * NEXORA Epistemic & Uncertainty Kernel v1
 *
 * Models what NEXORA can legitimately claim to know for a cognitive turn.
 * It does not create facts, mutate memory, grant authority, or execute tools.
 */

export type EpistemicStatus = "known" | "probable" | "unknown" | "conflicted" | "stale";
export type EpistemicClaimKind = "fact" | "inference" | "preference" | "prediction" | "external_fact";

export type NexoraEpistemicClaim = {
  key: string;
  kind: EpistemicClaimKind;
  statement: string;
  status: EpistemicStatus;
  confidence: number;
  requiresEvidence: boolean;
  requiresUserConfirmation: boolean;
  sourceCount: number;
  staleAfterDays?: number;
};

export type NexoraEpistemicResult = {
  version: 1;
  claims: NexoraEpistemicClaim[];
  overallStatus: EpistemicStatus;
  confidence: number;
  blockers: string[];
  nextStep: "proceed" | "verify" | "research" | "clarify" | "reconcile";
  authority: {
    createsFacts: false;
    mutatesMemory: false;
    authorizesFinancialWrite: false;
    policyEngineAuthoritative: true;
    decisionGateAuthoritative: true;
  };
  invariants: string[];
};

const INVARIANTS = [
  "epistemic_kernel_never_creates_facts",
  "epistemic_kernel_never_mutates_memory",
  "epistemic_kernel_never_authorizes_financial_write",
  "unknown_is_not_false",
  "probable_is_not_certain",
  "conflicts_require_reconciliation",
  "stale_claims_require_refresh_before_external_fact_claim",
  "policy_engine_remains_authoritative",
  "decision_gate_remains_authoritative",
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function runNexoraEpistemicKernel(args: {
  claims: NexoraEpistemicClaim[];
  externalResearchAvailable?: boolean;
}): NexoraEpistemicResult {
  const claims = args.claims.slice(0, 20).map((claim) => ({
    ...claim,
    confidence: clamp(claim.confidence),
    statement: claim.statement.slice(0, 500),
  }));
  const blockers: string[] = [];

  if (claims.some((c) => c.status === "conflicted")) blockers.push("conflicted_claims");
  if (claims.some((c) => c.status === "unknown" && c.requiresEvidence)) blockers.push("required_unknowns");
  if (claims.some((c) => c.status === "stale")) blockers.push("stale_claims");
  if (claims.some((c) => c.kind === "external_fact" && c.requiresEvidence && !args.externalResearchAvailable)) {
    blockers.push("external_evidence_unavailable");
  }
  if (claims.some((c) => c.requiresUserConfirmation && c.status !== "known")) blockers.push("user_confirmation_required");

  let overallStatus: EpistemicStatus = "known";
  if (claims.some((c) => c.status === "conflicted")) overallStatus = "conflicted";
  else if (claims.some((c) => c.status === "unknown")) overallStatus = "unknown";
  else if (claims.some((c) => c.status === "stale")) overallStatus = "stale";
  else if (claims.some((c) => c.status === "probable")) overallStatus = "probable";

  const confidence = claims.length
    ? clamp(claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length - blockers.length * 10)
    : 0;

  let nextStep: NexoraEpistemicResult["nextStep"] = "proceed";
  if (blockers.includes("conflicted_claims")) nextStep = "reconcile";
  else if (blockers.includes("user_confirmation_required")) nextStep = "clarify";
  else if (blockers.includes("external_evidence_unavailable")) nextStep = "research";
  else if (blockers.includes("required_unknowns") || blockers.includes("stale_claims")) nextStep = "verify";

  return {
    version: 1,
    claims,
    overallStatus,
    confidence,
    blockers,
    nextStep,
    authority: {
      createsFacts: false,
      mutatesMemory: false,
      authorizesFinancialWrite: false,
      policyEngineAuthoritative: true,
      decisionGateAuthoritative: true,
    },
    invariants: INVARIANTS,
  };
}
