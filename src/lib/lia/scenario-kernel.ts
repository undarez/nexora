/**
 * NEXORA Scenario & Counterfactual Kernel v1
 *
 * Converts supported causal hypotheses into bounded scenarios. This is a
 * planning aid, not a forecasting authority: it never creates facts,
 * mutates memory, executes tools, or authorizes financial writes.
 */

export type ScenarioMode = "baseline" | "counterfactual" | "stress" | "alternative";
export type ScenarioStatus = "supported" | "conditional" | "blocked";

export type NexoraScenario = {
  id: string;
  mode: ScenarioMode;
  premise: string;
  expectedEffect?: string;
  causalSupport?: number;
  assumptions?: string[];
  uncertainty?: string[];
};

export type NexoraScenarioResult = {
  version: 1;
  scenarios: Array<NexoraScenario & { status: ScenarioStatus; confidence: number }>;
  blockers: string[];
  nextStep: "proceed" | "verify" | "research" | "reconcile";
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
  "scenario_kernel_never_presents_projection_as_fact",
  "counterfactuals_require_causal_support",
  "stress_scenarios_are_conditional",
  "assumptions_must_remain_explicit",
  "scenario_kernel_never_creates_facts",
  "scenario_kernel_never_mutates_memory",
  "scenario_kernel_never_executes_tools",
  "scenario_kernel_never_authorizes_financial_write",
  "policy_engine_remains_authoritative",
  "decision_gate_remains_authoritative",
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function runNexoraScenarioKernel(args: {
  scenarios: NexoraScenario[];
  causalSupport?: number;
}): NexoraScenarioResult {
  const blockers: string[] = [];
  const globalSupport = clamp(args.causalSupport ?? 0);

  const scenarios = args.scenarios.slice(0, 8).map((input, index) => {
    const assumptions = input.assumptions ?? [];
    const uncertainty = input.uncertainty ?? [];
    const support = clamp(input.causalSupport ?? globalSupport);
    let status: ScenarioStatus = "conditional";
    let confidence = clamp(Math.min(75, support));

    if (!input.premise.trim()) {
      status = "blocked";
      confidence = 0;
    } else if (input.mode === "counterfactual") {
      if (support < 80) {
        status = "blocked";
        confidence = Math.min(confidence, 50);
      } else {
        status = "supported";
        confidence = Math.max(80, confidence);
      }
    } else if (input.mode === "baseline") {
      status = "supported";
      confidence = Math.max(60, confidence);
    } else if (input.mode === "stress") {
      status = "conditional";
      confidence = Math.min(confidence, 70);
    }

    if (assumptions.length > 4) confidence = clamp(confidence - 10);
    if (uncertainty.length > 3) confidence = clamp(confidence - 10);

    return {
      ...input,
      id: input.id || `scenario-${index + 1}`,
      assumptions,
      uncertainty,
      status,
      confidence,
    };
  });

  if (scenarios.some((s) => s.status === "blocked")) blockers.push("scenario_support_or_premise_blocked");
  if (scenarios.some((s) => s.mode === "counterfactual" && s.status !== "supported")) blockers.push("counterfactual_requires_stronger_causal_support");
  if (scenarios.some((s) => s.mode === "stress" && s.assumptions.length === 0)) blockers.push("stress_scenario_requires_explicit_assumptions");

  let nextStep: NexoraScenarioResult["nextStep"] = "proceed";
  if (blockers.some((b) => b.includes("support") || b.includes("blocked"))) nextStep = "verify";
  else if (blockers.some((b) => b.includes("assumptions"))) nextStep = "research";

  return {
    version: 1,
    scenarios,
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
