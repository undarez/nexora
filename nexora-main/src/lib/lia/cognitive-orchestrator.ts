import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAgentLoopStep, recordEvidence } from "@/lib/agents/loop-engine";
import type { LiaDecisionResult } from "@/lib/lia/decision-router";
import type { LiaMemoryContext } from "@/lib/lia/memory-context";

export const LIA_COGNITIVE_PIPELINE = [
  "objective",
  "understand",
  "decompose",
  "unknowns",
  "context",
  "research",
  "verify",
  "plan",
  "critique",
  "authorize",
  "act",
  "observe",
  "evaluate",
  "diagnose",
  "learn",
  "memorize",
  "next_action",
] as const;

export type CognitiveOrchestrationInput = {
  question: string;
  task: string;
  decision: LiaDecisionResult;
  memoryCount: number;
  toolNames: string[];
  hasFinancialContext: boolean;
  externalResearchRequested: boolean;
};

export type CognitiveOrchestrationPlan = {
  pipeline: typeof LIA_COGNITIVE_PIPELINE;
  current: "objective" | "understand" | "research" | "plan";
  next: "research" | "plan" | "clarify" | "provider";
  authorization: {
    modelAuthority: "advisory_only";
    financialWriteAllowed: false;
    criticalActionRequiresHuman: true;
  };
  context: {
    memoryIncluded: boolean;
    financialContextIncluded: boolean;
    toolsIncluded: boolean;
    externalResearchRequested: boolean;
  };
};

export function buildCognitiveOrchestrationPlan(input: CognitiveOrchestrationInput): CognitiveOrchestrationPlan {
  const needsClarification = input.decision.decision === "clarify";
  const needsResearch = input.decision.decision === "research" && input.externalResearchRequested;

  return {
    pipeline: LIA_COGNITIVE_PIPELINE,
    current: needsClarification ? "understand" : needsResearch ? "research" : "plan",
    next: needsClarification ? "clarify" : needsResearch ? "provider" : "plan",
    authorization: {
      modelAuthority: "advisory_only",
      financialWriteAllowed: false,
      criticalActionRequiresHuman: true,
    },
    context: {
      memoryIncluded: input.memoryCount > 0,
      financialContextIncluded: input.hasFinancialContext,
      toolsIncluded: input.toolNames.length > 0,
      externalResearchRequested: input.externalResearchRequested,
    },
  };
}

/**
 * Central coordination boundary. It only records the deterministic plan and
 * governance state; it never delegates authorization to the model.
 */
export async function recordCognitiveOrchestration(args: {
  supabase: SupabaseClient;
  loopRunId: string;
  input: CognitiveOrchestrationInput;
}) {
  const plan = buildCognitiveOrchestrationPlan(args.input);
  const stepId = await recordAgentLoopStep(args.supabase, args.loopRunId, 14, {
    phase: plan.next === "plan" ? "plan" : plan.next === "provider" ? "act" : "context",
    agentKey: "lia:cognitive-orchestrator",
    input: {
      question_length: args.input.question.length,
      task: args.input.task,
      decision: args.input.decision.decision,
      decision_confidence: args.input.decision.confidence,
      memory_count: args.input.memoryCount,
      tool_count: args.input.toolNames.length,
    },
    output: plan as unknown as Record<string, unknown>,
    status: args.input.decision.decision === "clarify" ? "needs_human" : "completed",
  });
  await recordEvidence(
    args.supabase,
    args.loopRunId,
    "lia-cognitive-orchestrator",
    "cognitive.orchestration_plan",
    {
      pipeline: plan.pipeline,
      decision: args.input.decision,
      authorization: plan.authorization,
      context: plan.context,
    },
    stepId,
  );
  return plan;
}
