import type { SupabaseClient } from "@supabase/supabase-js";

export type RelationalSignal = {
  signal: string;
  value: Record<string, unknown>;
  source: "explicit_user_feedback";
};

const rules: Array<[RegExp, string, Record<string, unknown>]> = [
  [/\\b(plus court|fais court|sois bref|moins long|résume|résumé)\\b/i, "detail_level", { detail_level: "concise" }],
  [/\\b(plus détaill|davantage de détail|explique davantage|plus d'explication)\\b/i, "detail_level", { detail_level: "detailed" }],
  [/\\b(sois direct|plus direct|va droit au but)\\b/i, "preferred_tone", { preferred_tone: "direct" }],
  [/\\b(sois encourageant|encourage[- ]moi)\\b/i, "preferred_tone", { preferred_tone: "encouraging" }],
  [/\\b(plus chaleureux|sois chaleureux)\\b/i, "preferred_tone", { preferred_tone: "warm" }],
  [/\\b(ne me propose pas|attends mon accord|demande[- ]moi avant)\\b/i, "initiative_level", { initiative_level: 0 }],
  [/\\b(propose[- ]moi directement|prends davantage d'initiative|sois plus proactif)\\b/i, "initiative_level", { initiative_level: 3 }],
];

export function detectExplicitRelationalFeedback(message: string): RelationalSignal | null {
  for (const [pattern, signal, value] of rules) {
    if (pattern.test(message)) return { signal, value, source: "explicit_user_feedback" };
  }
  return null;
}

export async function recordExplicitRelationalFeedback(
  supabase: SupabaseClient,
  userId: string,
  signal: RelationalSignal,
) {
  const { error } = await supabase.rpc("lia_apply_relational_feedback", {
    p_user_id: userId,
    p_signal: signal.signal,
    p_value: signal.value,
  });
  if (error) throw error;
}
