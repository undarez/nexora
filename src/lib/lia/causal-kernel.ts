/**
 * NEXORA Causal Reasoning Kernel v1
 *
 * Separates observed association from causal explanation and counterfactual claims.
 * Deterministic, bounded, and non-authoritative: it cannot mutate memory, execute tools,
 * or authorize financial writes.
 */

export type CausalStatus = "observed" | "associated" | "causal_candidate" | "unsupported" | "conflicted";
export type CausalRelation = "increase" | "decrease" | "none" | "unknown";

export type NexoraCausalHypothesis = {
  cause: string;
  effect: string;
  relation: CausalRelation;
  observations: number;
  confounders?: string[];
  temporalOrderEstablished?: boolean;
  interventionEvidence?: boolean;
  alternativeExplanations?: string[];
  status?: CausalStatus;
  confidence?: number;
};

export type NexoraCausalResult = {
  version: 1;
  hypotheses: Array<NexoraCausalHypothesis & { status: CausalStatus; confidence: number }>;
  blockers: string[];
  nextStep: "proceed" | "verify" | "research" | "reconcile";
  counterfactualAllowed: boolean;
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
  "causal_kernel_never_equates_correlation_with_causation",
  "temporal_order_is_required_for_causal_candidate",
  "confounders_reduce_causal_confidence",
  "counterfactuals_require_causal_support",
  "causal_kernel_never_creates_facts",
  "causal_kernel_never_mutates_memory",
  "causal_kernel_never_authorizes_financial_write",
  "policy_engine_remains_authoritative",
  "decision_gate_remains_authoritative",
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function runNexoraCausalKernel(args: {
  hypotheses: NexoraCausalHypothesis[];
}): NexoraCausalResult {
  const blockers: string[] = [];
  const hypotheses = args.hypotheses.slice(0, 12).map((input) => {
    const observations = Math.max(0, Math.floor(input.observations));
    const confounders = input.confounders ?? [];
    const alternatives = input.alternativeExplanations ?? [];
    const temporal = input.temporalOrderEstablished === true;
    const intervention = input.interventionEvidence === true;

    let status: CausalStatus = input.status ?? "observed";
    let confidence = clamp(input.confidence ?? 0);

    if (input.status !== "conflicted") {
      if (observations === 0) {
        status = "unsupported";
        confidence = 0;
      } else if (!temporal) {
        status = "associated";
        confidence = Math.min(confidence || 55, 55);
      } else if (intervention || (confounders.length === 0 && alternatives.length === 0 && observations >= 3)) {
        status = "causal_candidate";
        confidence = Math.max(confidence, intervention ? 80 : 65);
      } else {
        status = "causal_candidate";
        confidence = Math.min(Math.max(confidence, 50), 75);
      }
    } else {
      confidence = Math.min(confidence, 30);
    }

    if (confounders.length) confidence = clamp(confidence - Math.min(30, confounders.length * 10));
    if (alternatives.length) confidence = clamp(confidence - Math.min(20, alternatives.length * 5));

    return { ...input, status, confidence, observations, confounders, alternativeExplanations: alternatives };
  });

  if (hypotheses.some((h) => h.status === "conflicted")) blockers.push("conflicted_causal_hypotheses");
  if (hypotheses.some((h) => h.status === "unsupported")) blockers.push("unsupported_causal_hypotheses");
  if (hypotheses.some((h) => h.status === "associated")) blockers.push("association_without_causal_support");
  if (hypotheses.some((h) => h.status === "causal_candidate" && h.confidence < 70)) blockers.push("causal_support_needs_strengthening");

  let nextStep: NexoraCausalResult["nextStep"] = "proceed";
  if (blockers.includes("conflicted_causal_hypotheses")) nextStep = "reconcile";
  else if (blockers.includes("unsupported_causal_hypotheses") || blockers.includes("association_without_causal_support")) nextStep = "verify";
  else if (blockers.includes("causal_support_needs_strengthening")) nextStep = "research";

  return {
    version: 1,
    hypotheses,
    blockers,
    nextStep,
    counterfactualAllowed: hypotheses.length > 0 && hypotheses.every((h) => h.status === "causal_candidate" && h.confidence >= 80),
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
