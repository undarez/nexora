import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAgentLoopStep } from "@/lib/agents/loop-engine";
import { buildLiaBrainContext } from "@/lib/lia/financial-memory/pipeline";

export async function loadLiaBrainContextForTurn(args: {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  loopRunId: string | null;
  transactions: Array<{ id: string; label: string; amount: number; occurred_at: string }>;
}) {
  try {
    const brainContext = await buildLiaBrainContext({
      supabase: args.supabase,
      userId: args.userId,
      query: args.query,
      loopRunId: args.loopRunId,
      transactions: args.transactions,
    });

    if (args.loopRunId) {
      try {
        await recordAgentLoopStep(args.supabase, args.loopRunId, 25, {
          phase: "context",
          agentKey: "lia:financial-brain",
          input: { query: args.query.slice(0, 500) },
          output: {
            governed_skill: brainContext.skill?.slug ?? null,
            skill_version: brainContext.skill?.version ?? null,
            knowledge_count: brainContext.knowledge.length,
            memory_count: brainContext.memories.length,
            habit_count: brainContext.habits.length,
            relational_included: Boolean(brainContext.relational),
          },
          status: "completed",
        });
      } catch (error) {
        console.warn(
          "Impossible d'enregistrer le contexte du cerveau financier:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    return brainContext;
  } catch (error) {
    console.warn(
      "Contexte cerveau financier indisponible; poursuite bornée:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
