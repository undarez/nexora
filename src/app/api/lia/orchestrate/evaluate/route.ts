import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { evaluateLiaGoal, persistLiaGoalEvaluation } from "@/lib/lia/goal-completion";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.run_id !== "string") return NextResponse.json({ error: "run_id invalide." }, { status: 400 });
  try {
    const { data: run, error } = await supabase.from("lia_orchestration_runs").select("id,user_id,objective,status,result,context,max_steps,current_step").eq("id", body.run_id).eq("user_id", user.id).single();
    if (error || !run) return NextResponse.json({ error: "Orchestration introuvable." }, { status: 404 });
    const { data: steps, error: stepsError } = await supabase.from("lia_orchestration_steps").select("status,output_context").eq("run_id", run.id).order("step_index", { ascending: true });
    if (stepsError) throw new Error(stepsError.message);
    const criteria = Array.isArray(body.success_criteria) ? body.success_criteria : run.context?.success_criteria;
    const evaluation = evaluateLiaGoal({ objective: run.objective, successCriteria: criteria, result: run.result, steps: steps ?? [], orchestrationStatus: run.status });
    await persistLiaGoalEvaluation({ supabase, userId: user.id, runId: run.id, evaluation });
    if (evaluation.status === "completed" && run.status !== "completed") {
      await supabase.from("lia_orchestration_runs").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), result: { ...((run.result && typeof run.result === "object") ? run.result : {}), goal_evaluation: evaluation } }).eq("id", run.id).eq("user_id", user.id);
    }
    return NextResponse.json({ run_id: run.id, evaluation });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Évaluation impossible." }, { status: 500 }); }
}
