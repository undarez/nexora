import type { SupabaseClient } from "@supabase/supabase-js";

export type PostActionOutcome = "verified" | "mismatch" | "inconclusive" | "failed";
export type ObservationResult = { outcome: PostActionOutcome; checks: Array<{ key:string; expected:boolean; observed:boolean; detail:string }>; observed: Record<string,unknown> };

/** Deterministic post-condition evaluator. It never grants permission and never calls the LLM. */
export async function observeExecutedAction(admin: SupabaseClient, args: {
  proposalId: string; loopRunId?: string | null; userId: string; actionKey: string; expected: Record<string,unknown>;
}): Promise<ObservationResult> {
  const checks: ObservationResult["checks"] = [];
  if (args.actionKey !== "create_recommendation") {
    return { outcome:"inconclusive", checks:[{key:"supported_action",expected:true,observed:false,detail:"No deterministic post-condition evaluator is registered for this action."}], observed:{} };
  }
  const recommendationId = typeof args.expected.recommendation_id === "string" ? args.expected.recommendation_id : "";
  if (!recommendationId) return { outcome:"inconclusive", checks:[{key:"recommendation_id",expected:true,observed:false,detail:"Missing recommendation id."}], observed:{} };
  const { data, error } = await admin.from("recommendations").select("id,user_id,status,type").eq("id", recommendationId).eq("user_id", args.userId).maybeSingle();
  const exists = Boolean(data) && !error;
  checks.push({ key:"recommendation_exists", expected:true, observed:exists, detail: error?.message ?? (exists ? "Recommendation exists for the authenticated user." : "Recommendation not found.") });
  const typeOk = data?.type === "ai_analysis";
  checks.push({ key:"recommendation_type", expected:true, observed:typeOk, detail:`type=${String(data?.type ?? "missing")}` });
  const outcome: PostActionOutcome = error ? "failed" : exists && typeOk ? "verified" : "mismatch";
  return { outcome, checks, observed:{ recommendation_id: recommendationId, found:exists, status:data?.status ?? null, type:data?.type ?? null } };
}
