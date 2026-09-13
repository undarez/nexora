/**
 * NEXORA Active Inquiry & Value-of-Information Kernel v1
 *
 * Selects the smallest useful next inquiry when uncertainty blocks a plan.
 * It ranks information requests by decision impact, evidence quality and cost.
 * It never executes research, creates facts, mutates memory or authorizes writes.
 */

export type InquiryKind = "clarification" | "research" | "verification" | "reconciliation";
export type InquiryStatus = "recommended" | "deferred" | "blocked";

export type NexoraInquiry = {
  id: string;
  kind: InquiryKind;
  question: string;
  targetUncertainty: string;
  expectedDecisionImpact: number;
  evidenceQuality: number;
  effort: number;
  urgency?: number;
  prerequisites?: string[];
};

export type NexoraInquiryResult = {
  version: 1;
  selected: NexoraInquiry & { status: InquiryStatus; valueScore: number } | null;
  ranked: Array<NexoraInquiry & { status: InquiryStatus; valueScore: number }>;
  blockers: string[];
  nextStep: "ask" | "research" | "verify" | "reconcile" | "proceed";
  authority: {
    createsFacts: false;
    mutatesMemory: false;
    executesTools: false;
    authorizesFinancialWrite: false;
    policyEngineAuthoritative: true;
    decisionGateAuthoritative: true;
  };
  invariants: string[];
};

const INVARIANTS = [
  "inquiry_kernel_never_creates_facts",
  "inquiry_kernel_never_mutates_memory",
  "inquiry_kernel_never_executes_tools",
  "inquiry_kernel_never_authorizes_financial_write",
  "value_of_information_is_a_ranking_not_a_fact",
  "minimal_inquiry_is_preferred",
  "prerequisites_remain_explicit",
  "policy_engine_remains_authoritative",
  "decision_gate_remains_authoritative",
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function runNexoraInquiryKernel(args: {
  inquiries: NexoraInquiry[];
  maxResults?: number;
}): NexoraInquiryResult {
  const blockers: string[] = [];
  const maxResults = Math.max(1, Math.min(6, args.maxResults ?? 4));

  const ranked = args.inquiries
    .slice(0, 12)
    .map((input, index) => {
      const prerequisites = input.prerequisites ?? [];
      const impact = clamp(input.expectedDecisionImpact);
      const quality = clamp(input.evidenceQuality);
      const effort = clamp(input.effort);
      const urgency = clamp(input.urgency ?? 50);
      const valueScore = clamp((impact * 0.45) + (quality * 0.25) + (urgency * 0.15) + ((100 - effort) * 0.15));
      let status: InquiryStatus = "recommended";

      if (!input.question.trim() || !input.targetUncertainty.trim()) status = "blocked";
      else if (prerequisites.length > 3 || effort > 90) status = "deferred";

      return {
        ...input,
        id: input.id || `inquiry-${index + 1}`,
        prerequisites,
        status,
        valueScore,
      };
    })
    .sort((a, b) => b.valueScore - a.valueScore)
    .slice(0, maxResults);

  if (ranked.length === 0) blockers.push("no_information_request_available");
  if (ranked.some((item) => item.status === "blocked")) blockers.push("invalid_information_request");

  const selected = ranked.find((item) => item.status === "recommended") ?? null;
  if (!selected && ranked.length > 0) blockers.push("no_actionable_inquiry");

  let nextStep: NexoraInquiryResult["nextStep"] = "proceed";
  if (selected?.kind === "clarification") nextStep = "ask";
  else if (selected?.kind === "research") nextStep = "research";
  else if (selected?.kind === "verification") nextStep = "verify";
  else if (selected?.kind === "reconciliation") nextStep = "reconcile";
  else if (blockers.length > 0) nextStep = "verify";

  return {
    version: 1,
    selected,
    ranked,
    blockers,
    nextStep,
    authority: {
      createsFacts: false,
      mutatesMemory: false,
      executesTools: false,
      authorizesFinancialWrite: false,
      policyEngineAuthoritative: true,
      decisionGateAuthoritative: true,
    },
    invariants: INVARIANTS,
  };
}
