import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { decideLiaRecovery } from "@/lib/lia/adaptive-recovery";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const runId = typeof body.runId === "string" ? body.runId : null;
  if (!runId) return NextResponse.json({ error: "runId requis." }, { status: 400 });

  const { data: run, error } = await supabase.from("lia_orchestration_runs")
    .select("id,status,current_step,max_steps").eq("id", runId).eq("user_id", user.id).single();
  if (error || !run) return NextResponse.json({ error: "Orchestration introuvable." }, { status: 404 });
  if (["completed", "cancelled", "blocked"].includes(run.status)) return NextResponse.json({ status: run.status, recovered: false });

  const { data: step } = await supabase.from("lia_orchestration_steps")
    .select("id,step_index,procedure_slug,retry_count,status,output_context")
    .eq("run_id", run.id).eq("step_index", Number(run.current_step) + 1).single();
  if (!step) return NextResponse.json({ status: "completed", recovered: false });

  const recovery = decideLiaRecovery({ procedure: step.procedure_slug ?? "", retryCount: Number(step.retry_count ?? 0), error: "manual_recovery_request" });
  if (!recovery.retryAllowed || !recovery.nextProcedure) {
    await supabase.from("lia_orchestration_steps").update({ status: "failed", recovery_strategy: "stop", recovery_reason: recovery.reason, last_error: recovery.reason }).eq("id", step.id);
    await supabase.from("lia_orchestration_runs").update({ status: "failed", result: { recovery }, updated_at: new Date().toISOString() }).eq("id", run.id);
    return NextResponse.json({ status: "failed", recovered: false, recovery });
  }

  await supabase.from("lia_orchestration_steps").update({
    status: "planned", procedure_slug: recovery.nextProcedure, recovery_strategy: recovery.strategy,
    recovery_reason: recovery.reason, last_error: null,
    output_context: { ...(step.output_context ?? {}), recovery }
  }).eq("id", step.id);
  await supabase.from("lia_orchestration_runs").update({ status: "running", updated_at: new Date().toISOString(), result: { recovery, resumed_step: step.step_index } }).eq("id", run.id);
  return NextResponse.json({ status: "running", recovered: true, step_index: step.step_index, recovery });
}
