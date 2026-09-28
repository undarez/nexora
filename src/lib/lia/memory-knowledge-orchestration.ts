import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMemoryCandidate,
  retrieveLiaMemories,
  type LiaMemoryContext,
} from "@/lib/lia/memory-context";
import { recordFinancialMemoryVersion } from "@/lib/lia/financial-memory/pipeline";

export async function loadLiaDurableMemory(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<LiaMemoryContext[]> {
  return retrieveLiaMemories(supabase, userId, query);
}

export async function proposeLiaMemoryFromTurn(args: {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  loopRunId: string;
}): Promise<{ memoryCandidateId: string | null }> {
  const memoryCandidateId = await createMemoryCandidate(
    args.supabase,
    args.userId,
    args.query,
    args.loopRunId,
  );

  if (memoryCandidateId) {
    await recordFinancialMemoryVersion({
      memoryId: String(memoryCandidateId),
      content: {
        instruction: args.query.slice(0, 1200),
        source: "explicit_user_request",
        loop_run_id: args.loopRunId,
        activation_allowed: false,
      },
      status: "proposed",
      reason: "explicit_user_request",
      changedBy: "lia",
    });
  }

  return { memoryCandidateId };
}
