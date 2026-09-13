import type { SupabaseClient } from "@supabase/supabase-js";

export type MetacognitivePlan = {
  objective: string;
  known: string[];
  gaps: string[];
  action: "research" | "verify" | "review";
  rationale: string;
  nextObjective: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function unique(values: string[]) {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))].slice(0, 8);
}

export async function buildMetacognitivePlan(admin: SupabaseClient, userId: string, objective: string): Promise<MetacognitivePlan> {
  const [{ data: knowledge }, { data: learning }, { data: prior }] = await Promise.all([
    admin.from("lia_knowledge").select("claim,confidence,state,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    admin.from("lia_learning_records").select("lesson,confidence,memory_gate,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    admin.from("lia_metacognitive_cycles").select("objective,next_objective,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
  ]);

  const known = unique((knowledge ?? []).filter((k: any) => k.state === "verified" || Number(k.confidence ?? 0) >= 80).map((k: any) => String(k.claim ?? "")).slice(0, 6));
  const learned = unique((learning ?? []).filter((l: any) => l.memory_gate === "accepted" || Number(l.confidence ?? 0) >= 80).map((l: any) => String(l.lesson ?? "")).slice(0, 4));
  const repeated = new Set((prior ?? []).map((p: any) => String(p.objective ?? "").toLowerCase()));

  const gaps: string[] = [];
  if (!known.length) gaps.push("établir une base de connaissances vérifiée sur le sujet");
  if (!learned.length) gaps.push("obtenir au moins une connaissance reproductible et validée");
  if ((knowledge ?? []).filter((k: any) => Number(k.confidence ?? 0) < 80).length > 3) gaps.push("réévaluer les connaissances à confiance faible");
  if (!gaps.length) gaps.push("chercher une source indépendante et vérifier les éventuelles contradictions");

  const normalizedObjective = objective.trim().slice(0, 500) || "améliorer les connaissances financières et la sécurité de LIA";
  const repeatedObjective = repeated.has(normalizedObjective.toLowerCase());
  const action: MetacognitivePlan["action"] = repeatedObjective || known.length > 0 ? "verify" : "research";
  const nextObjective = repeatedObjective
    ? `approfondir un angle non couvert de : ${normalizedObjective}`.slice(0, 500)
    : `vérifier les connaissances acquises sur : ${normalizedObjective}`.slice(0, 500);

  return {
    objective: normalizedObjective,
    known,
    gaps,
    action,
    rationale: action === "research" ? "Les connaissances vérifiées sont insuffisantes ; une recherche bornée est prioritaire." : "Des connaissances existent déjà ; LIA doit d'abord les vérifier et chercher les contradictions avant d'élargir son corpus.",
    nextObjective,
  };
}

export async function recordMetacognitivePlan(admin: SupabaseClient, userId: string, plan: MetacognitivePlan, learningCycleId?: string | null) {
  const { data, error } = await admin.from("lia_metacognitive_cycles").insert({
    user_id: userId,
    learning_cycle_id: learningCycleId ?? null,
    objective: plan.objective,
    known_context: { known: plan.known, known_count: plan.known.length },
    knowledge_gaps: plan.gaps,
    selected_action: { action: plan.action, rationale: plan.rationale },
    evaluation: { confidence: clamp(plan.known.length * 15 + (plan.gaps.length === 1 ? 20 : 0), 0, 100), bounded: true },
    next_objective: plan.nextObjective,
    status: "planned",
    guardrails: { max_sources: 4, trusted_domains_only: true, no_financial_writes: true, no_policy_changes: true, no_permission_changes: true, no_model_weight_changes: true },
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "metacognitive_cycle_create_failed");
  return String(data.id);
}
