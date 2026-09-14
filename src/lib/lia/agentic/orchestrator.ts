import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentHarness } from "@/lib/lia/agent-harness";
import { chooseNextReasoningStepV2 } from "@/lib/lia/reasoning-engine-v2";
import { buildLiaBrainContext, compactBrainContext } from "@/lib/lia/financial-memory/pipeline";
import { executeAgentTool } from "@/lib/agent-runtime/executor";
import { verifyReadOnlyObservation, summarizeVerifiedObservation } from "@/lib/lia/autonomy/verifier";
import { recordAgentLoopStep, recordEvidence } from "@/lib/agents/loop-engine";

const SAFE_TOOLS = ["get_financial_snapshot", "get_budget_status", "get_cashflow", "get_wealth_snapshot", "get_forecast", "search_transactions", "search_skills", "search_use_cases"];

export async function runAgenticOrchestration(args: {
  supabase: SupabaseClient;
  userId: string;
  loopRunId: string;
  goal: string;
  task?: string;
  maxSteps?: number;
}) {
  const harness = new AgentHarness({ maxSteps: Math.min(args.maxSteps ?? 8, 12), maxToolCalls: 8, maxWallTimeMs: 120_000, maxRepeatedCalls: 0 });
  const brain = compactBrainContext(await buildLiaBrainContext({ supabase: args.supabase, userId: args.userId, query: args.goal, loopRunId: args.loopRunId }));
  const memory = { facts: [] as string[], openQuestions: [] as string[], completedTools: [] as string[], failedTools: [] as string[], checks: [] as string[], replans: 0, verifiedObservations: 0 };
  const observations: Array<{ tool: string; ok: boolean; summary?: string }> = [];

  for (let i = 0; i < harness.limits.maxSteps; i++) {
    const guard = harness.guard("model", `decision:${i}:${memory.completedTools.join(",")}`);
    if (!guard.allowed) break;
    const decision = await chooseNextReasoningStepV2({ goal: args.goal, task: args.task ?? "financial_analysis", allowedTools: SAFE_TOOLS, memory, observations, remainingSteps: harness.limits.maxSteps - i, durableContext: brain });
    harness.record({ kind: "model", name: "reasoning-engine-v2", ok: true, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), durationMs: 0 });
    await recordAgentLoopStep(args.supabase, args.loopRunId, 100 + i, { phase: "decide", agentKey: "lia:agentic-orchestrator", input: { remaining_steps: harness.limits.maxSteps - i, memory }, output: { action: decision.action, tool: decision.tool, objective: decision.objective, confidence: decision.confidence }, status: "completed" });
    memory.openQuestions = decision.questions;
    memory.checks.push(...decision.checks);
    if (decision.action !== "use_tool" || !decision.tool) break;

    const toolGuard = harness.guard("tool", `tool:${decision.tool}`);
    if (!toolGuard.allowed) break;
    const started = Date.now();
    try {
      const result = await executeAgentTool(args.supabase, args.userId, { name: decision.tool }, { runId: args.loopRunId });
      const verification = verifyReadOnlyObservation(result, observations);
      const summary = summarizeVerifiedObservation(result);
      observations.push({ tool: decision.tool, ok: verification.passed, summary });
      memory.completedTools.push(decision.tool);
      memory.facts.push(`${decision.tool}: ${summary.slice(0, 900)}`);
      memory.verifiedObservations += verification.passed ? 1 : 0;
      memory.checks.push(...verification.checks.map(c => `${c.key}:${c.observed ? "ok" : "failed"}`));
      harness.record({ kind: "tool", name: decision.tool, ok: verification.passed, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - started, fingerprint: `tool:${decision.tool}` });
      const stepId = await recordAgentLoopStep(args.supabase, args.loopRunId, 200 + i, { phase: "verify", agentKey: "lia:autonomous-verifier", input: { tool: decision.tool }, output: { passed: verification.passed, confidence: verification.confidence }, status: verification.passed ? "completed" : "failed" });
      if (verification.passed && result && typeof result === "object") await recordEvidence(args.supabase, args.loopRunId, `orchestrator:${decision.tool}`, "verified_observation", { result, verification }, stepId);
      if (!verification.passed) memory.replans++;
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "tool_failed";
      memory.failedTools.push(decision.tool);
      memory.replans++;
      observations.push({ tool: decision.tool, ok: false, summary: message });
      harness.record({ kind: "blocked", name: decision.tool, ok: false, startedAt: new Date(started).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - started, fingerprint: `tool:${decision.tool}`, error: message });
    }
  }
  harness.complete(observations.some(o => o.ok) ? "completed" : "blocked", observations.some(o => o.ok) ? undefined : "Aucune observation vérifiée.");
  return { status: harness.state.status, observations, memory, harness: harness.summary(), brain_context_loaded: true, financial_writes_allowed: false, human_approval_required_for_sensitive_actions: true };
}
