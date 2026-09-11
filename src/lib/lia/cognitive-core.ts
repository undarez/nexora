import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAgentLoopStep, recordEvidence } from "@/lib/agents/loop-engine";

export type CognitiveState = "known" | "unknown" | "uncertain" | "assumed" | "verified" | "contradicted";
export type MemoryType = "working" | "episodic" | "semantic" | "procedural" | "strategic";
export type CognitivePhase = "objective" | "context" | "understand" | "decompose" | "unknowns" | "research" | "verify" | "plan" | "critique" | "authorize" | "act" | "observe" | "evaluate" | "diagnose" | "learn" | "memorize" | "next_action";

export type GoalSpec = {
  objective: string;
  motivation?: string;
  constraints?: string[];
  required_resources?: string[];
  success_criteria?: string[];
  risks?: string[];
  unknowns?: string[];
  deadline?: string | null;
};

export type CognitiveAssessment = {
  quality: number;
  accuracy: number;
  source: number;
  reasoning: number;
  execution: number;
  safety: number;
  autonomy: number;
  criticalFailure: boolean;
};

export function memoryGate(input: { useful: boolean; reliable: boolean; reproducible: boolean; obsolete: boolean; generalizable: boolean }) {
  if (!input.useful || !input.reliable || input.obsolete) return "rejected" as const;
  if (!input.reproducible && !input.generalizable) return "candidate" as const;
  return "accepted" as const;
}

export function assessAction(scores: Omit<CognitiveAssessment, "criticalFailure">): CognitiveAssessment {
  return { ...scores, criticalFailure: scores.safety < 60 };
}

export async function runCognitivePhase(args: {
  supabase: SupabaseClient;
  loopRunId: string;
  stepOrder: number;
  phase: CognitivePhase;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status?: "completed" | "failed" | "blocked" | "needs_human";
}) {
  const stepId = await recordAgentLoopStep(args.supabase, args.loopRunId, args.stepOrder, {
    phase: args.phase === "act" ? "act" : args.phase === "verify" ? "verify" : args.phase === "observe" ? "observe" : args.phase === "learn" || args.phase === "memorize" ? "learn" : args.phase === "next_action" ? "decide" : "plan",
    input: args.input,
    output: args.output,
    status: args.status ?? "completed",
  });
  await recordEvidence(args.supabase, args.loopRunId, "lia-cognitive-core", `cognitive.${args.phase}`, { input: args.input ?? {}, output: args.output ?? {}, status: args.status ?? "completed" }, stepId);
  return stepId;
}

export async function acceptLearningRecord(supabase: SupabaseClient, userId: string, record: {
  loopRunId?: string;
  lesson: string;
  context?: Record<string, unknown>;
  action?: Record<string, unknown>;
  expectedResult?: Record<string, unknown>;
  actualResult?: Record<string, unknown>;
  cause?: string;
  correction?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  confidence: number;
  reproducible: boolean;
  memoryType?: MemoryType;
  topic: string;
}) {
  const gate = memoryGate({ useful: true, reliable: record.confidence >= 70, reproducible: record.reproducible, obsolete: false, generalizable: true });
  const { data: learning, error } = await supabase.from("lia_learning_records").insert({
    user_id: userId,
    loop_run_id: record.loopRunId ?? null,
    lesson: record.lesson,
    context: record.context ?? {},
    action: record.action ?? {},
    expected_result: record.expectedResult ?? {},
    actual_result: record.actualResult ?? {},
    cause: record.cause ?? null,
    correction: record.correction ?? {},
    validation: record.validation ?? {},
    confidence: record.confidence,
    reproducible: record.reproducible,
    memory_gate: gate,
  }).select("id").single();
  if (error || !learning) throw new Error(error?.message ?? "Impossible d'enregistrer l'apprentissage.");
  if (gate === "accepted") {
    const { error: memoryError } = await supabase.from("lia_memory").insert({ user_id: userId, memory_type: record.memoryType ?? "strategic", topic: record.topic, content: { lesson: record.lesson, correction: record.correction ?? {}, validation: record.validation ?? {}, source_learning_id: learning.id }, source_kind: "learning", source_id: learning.id, reliability: record.confidence, reproducible: record.reproducible, status: "accepted" });
    if (memoryError) throw new Error(memoryError.message);
  }
  return { learningId: learning.id as string, gate };
}
