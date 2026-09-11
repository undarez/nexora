import type { SupabaseClient } from "@supabase/supabase-js";

export type GoalCompletionStatus = "continue" | "completed" | "needs_human" | "blocked" | "failed";
export type GoalEvaluation = {
  status: GoalCompletionStatus;
  achieved: boolean;
  progress: number;
  checks: Array<{ criterion: string; passed: boolean; detail: string }>;
  nextAction: string;
  reason: string;
};

function clean(v: unknown): Record<string, unknown> { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
function path(v: unknown, p: string): unknown { let x: any = v; for (const k of p.split(".")) { if (!x || typeof x !== "object" || !(k in x)) return undefined; x = x[k]; } return x; }

/** Deterministic goal evaluator. Criteria are explicit data paths/booleans; it never grants authority. */
export function evaluateLiaGoal(args: {
  objective: string;
  successCriteria?: unknown;
  result?: unknown;
  steps?: Array<{ status: string; output_context?: unknown }>;
  orchestrationStatus?: string;
}): GoalEvaluation {
  const result = clean(args.result);
  const steps = args.steps ?? [];
  const criteria = Array.isArray(args.successCriteria) ? args.successCriteria.filter((x): x is string => typeof x === "string" && Boolean(x.trim())).slice(0, 8) : [];
  const checks: GoalEvaluation["checks"] = [];
  for (const criterion of criteria) {
    const c = criterion.trim();
    if (c === "all_steps_completed") {
      const passed = steps.length > 0 && steps.every(s => s.status === "completed" || s.status === "skipped");
      checks.push({ criterion: c, passed, detail: passed ? "Toutes les étapes sont terminées." : "Au moins une étape reste à traiter." });
    } else if (c.startsWith("result.")) {
      const value = path(result, c.slice(7));
      const passed = value === true || (typeof value === "string" && value.length > 0) || (typeof value === "number" && value > 0);
      checks.push({ criterion: c, passed, detail: passed ? "Critère satisfait." : "Valeur attendue absente ou non valide." });
    } else if (c === "no_blocker") {
      const passed = args.orchestrationStatus !== "blocked" && args.orchestrationStatus !== "failed";
      checks.push({ criterion: c, passed, detail: passed ? "Aucun blocage terminal détecté." : "Un blocage terminal est présent." });
    } else {
      checks.push({ criterion: c, passed: false, detail: "Critère non interprétable sans règle déterministe explicite." });
    }
  }
  const all = checks.length > 0 && checks.every(x => x.passed);
  const terminal = args.orchestrationStatus === "blocked" ? "blocked" : args.orchestrationStatus === "failed" ? "failed" : args.orchestrationStatus === "awaiting_human" ? "needs_human" : null;
  if (terminal) return { status: terminal, achieved: false, progress: 0, checks, nextAction: terminal === "needs_human" ? "attendre la validation humaine" : "corriger le blocage avant de poursuivre", reason: `L'orchestration est ${args.orchestrationStatus}.` };
  if (all) return { status: "completed", achieved: true, progress: 100, checks, nextAction: "aucune nouvelle action requise", reason: "Tous les critères de réussite explicites sont satisfaits." };
  const done = steps.filter(s => s.status === "completed" || s.status === "skipped").length;
  const progress = steps.length ? Math.min(99, Math.round((done / steps.length) * 100)) : 0;
  return { status: "continue", achieved: false, progress, checks, nextAction: "poursuivre l'orchestration et réévaluer les critères", reason: criteria.length ? "Au moins un critère reste à satisfaire." : "Aucun critère de réussite explicite n'a été fourni." };
}

export async function persistLiaGoalEvaluation(args: { supabase: SupabaseClient; userId: string; runId: string; evaluation: GoalEvaluation }) {
  const { error } = await args.supabase.from("lia_goal_evaluations").insert({
    user_id: args.userId, orchestration_run_id: args.runId, status: args.evaluation.status,
    achieved: args.evaluation.achieved, progress: args.evaluation.progress,
    checks: args.evaluation.checks, next_action: args.evaluation.nextAction, reason: args.evaluation.reason,
  });
  if (error) throw new Error(error.message);
  return args.evaluation;
}
