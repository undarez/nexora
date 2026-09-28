import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAgentLoopStep, recordEvidence } from "@/lib/agents/loop-engine";
import { runLiveResearch } from "@/lib/lia/research/live";

export type LiaResearchEvidenceInput = {
  supabase: SupabaseClient;
  loopRunId: string | null;
  requested: boolean;
  decision: string;
  query: string;
  maxSources?: number;
  timeoutMs?: number;
};

export async function runLiaResearchEvidence(input: LiaResearchEvidenceInput) {
  if (!input.requested) {
    return { research: null, requested: false };
  }

  const research = await runLiveResearch({
    query: input.query,
    maxSources: input.maxSources ?? 5,
    timeoutMs: input.timeoutMs ?? 10_000,
    discover: true,
  });

  if (input.loopRunId) {
    await recordAgentLoopStep(input.supabase, input.loopRunId, 6, {
      phase: "context",
      agentKey: "lia:research",
      input: { requested: true, decision: input.decision },
      output: {
        provider: research.discovery.provider,
        status: research.discovery.status,
        evidence_count: research.evidence.length,
        contradictions: research.contradictions.length,
        minimum_evidence_met: research.minimumEvidenceMet,
      },
    });

    for (const item of research.evidence.slice(0, 8)) {
      await recordEvidence(
        input.supabase,
        input.loopRunId,
        "lia:research",
        "external_research_evidence",
        {
          claim: item.claim,
          source: item.source,
          confidence: item.confidence,
          state: item.state,
        },
      );
    }
  }

  return { research, requested: true };
}
