import { executeAgentTool } from "@/lib/agent-runtime/executor";
import { AgentHarness } from "@/lib/lia/agent-harness";
import type { createClient } from "@/lib/supabase/server";

export async function executeChatToolsWithHarness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  toolNames: readonly string[],
  runId: string | null,
) {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  // Chat tool execution stays bounded and observable; it never owns financial policy decisions.
  const harness = new AgentHarness({ maxSteps: 8, maxToolCalls: 8, maxWallTimeMs: 120_000, maxRepeatedCalls: 1 });
  const results: Record<string, unknown> = {};

  for (const toolName of toolNames) {
    const fingerprint = `chat-tool:${toolName}`;
    const guard = harness.guard("tool", fingerprint);
    if (!guard.allowed) {
      results[toolName] = { error: guard.reason, harness_blocked: true };
      break;
    }
    const startedAt = Date.now();
    try {
      const remainingMs = Math.max(1_000, harness.limits.maxWallTimeMs - (Date.now() - Date.parse(harness.state.startedAt)));
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Budget temps du harness atteint.")), remainingMs));
      results[toolName] = await Promise.race([
        executeAgentTool(supabase, userId, { name: toolName }, { runId }),
        timeout,
      ]);
      harness.record({ kind: "tool", name: toolName, ok: true, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, fingerprint });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Outil indisponible.";
      results[toolName] = { error: message };
      harness.record({ kind: "tool", name: toolName, ok: false, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, fingerprint, error: message.slice(0, 500) });
    }
  }

  if (harness.state.status === "running") harness.complete("completed");
  return { results, harness: harness.summary() };
}
