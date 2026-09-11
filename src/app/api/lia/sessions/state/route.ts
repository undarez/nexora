import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";

const PIPELINE = [
  ["objective", "Objectif"], ["understand", "Compréhension"], ["decompose", "Décomposition"],
  ["unknowns", "Inconnues"], ["context", "Contexte"], ["research", "Recherche"],
  ["verify", "Vérification"], ["plan", "Planification"], ["critique", "Critique"],
  ["authorize", "Autorisation"], ["act", "Action"], ["observe", "Observation"],
  ["evaluate", "Évaluation"], ["diagnose", "Diagnostic"], ["learn", "Apprentissage"],
  ["memorize", "Mémorisation"], ["next_action", "Prochaine action"],
] as const;

function phaseFromStep(step: any): string {
  const cognitive = String(step?.output?.cognitive_phase ?? step?.input?.cognitive_phase ?? "");
  if (PIPELINE.some(([key]) => key === cognitive)) return cognitive;
  const phase = String(step?.phase ?? "");
  if (phase === "decide") return "next_action";
  if (phase === "context") return "context";
  if (phase === "plan") return "plan";
  if (phase === "verify") return "verify";
  if (phase === "observe") return "observe";
  if (phase === "act") return "act";
  if (phase === "learn") return "learn";
  return "plan";
}

export async function GET(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId requis." }, { status: 400 });

  const { data: session, error: sessionError } = await supabase.from("lia_cognitive_sessions")
    .select("id,status,turn_count,active_loop_run_id,updated_at,context").eq("id", sessionId).eq("user_id", user.id).single();
  if (sessionError || !session) return NextResponse.json({ error: "Session introuvable." }, { status: 404 });
  if (!session.active_loop_run_id) return NextResponse.json({
    session: { id: session.id, status: session.status, turnCount: session.turn_count, updatedAt: session.updated_at, context: session.context ?? {} },
    goal: null, timeline: [], evidenceCount: 0, sessionTimeline: [], lastUpdatedAt: session.updated_at,
  });

  const [{ data: run, error: runError }, { data: steps }, { data: evidence }, { data: turns }] = await Promise.all([
    supabase.from("agent_loop_runs").select("id,status,goal,context,decision,created_at,completed_at").eq("id", session.active_loop_run_id).eq("user_id", user.id).single(),
    supabase.from("agent_loop_steps").select("id,step_order,phase,status,input,output,duration_ms,created_at").eq("loop_run_id", session.active_loop_run_id).order("step_order", { ascending: true }).limit(80),
    supabase.from("agent_evidence").select("id,evidence_type,payload,created_at").eq("loop_run_id", session.active_loop_run_id).order("created_at", { ascending: false }).limit(100),
    supabase.from("lia_cognitive_session_turns").select("id,turn_index,loop_run_id,question,answer_preview,loop_status,goal_state,progress,decision,created_at").eq("session_id", session.id).eq("user_id", user.id).order("turn_index", { ascending: false }).limit(12),
  ]);
  if (runError || !run) return NextResponse.json({ error: "Boucle cognitive introuvable." }, { status: 404 });

  const lifecycle = run.context?.goal_lifecycle ?? null;
  const recorded = new Map<string, any>();
  for (const step of steps ?? []) recorded.set(phaseFromStep(step), step);
  for (const item of evidence ?? []) {
    const type = String(item.evidence_type ?? "");
    if (!type.startsWith("cognitive.")) continue;
    const phase = type.slice("cognitive.".length);
    if (!PIPELINE.some(([key]) => key === phase)) continue;
    if (!recorded.has(phase)) recorded.set(phase, { status: item.payload?.status ?? "completed", created_at: item.created_at, duration_ms: null });
  }
  const currentPhase = lifecycle?.currentStep ?? lifecycle?.state ?? null;
  const timeline = PIPELINE.map(([key, label]) => {
    const step = recorded.get(key);
    const completed = Boolean(step) && step.status === "completed";
    const terminal = Boolean(step) && ["failed", "blocked", "needs_human"].includes(step.status);
    return {
      key, label,
      status: terminal ? step.status : completed ? "completed" : currentPhase === key ? "current" : "pending",
      createdAt: step?.created_at ?? null,
      durationMs: step?.duration_ms ?? null,
    };
  });

  return NextResponse.json({
    session: { id: session.id, status: session.status, turnCount: session.turn_count, updatedAt: session.updated_at, context: session.context ?? {} },
    goal: lifecycle ? { goalId: lifecycle.goalId, objective: lifecycle.objective, state: lifecycle.state, progress: lifecycle.progress, currentStep: lifecycle.currentStep, nextAction: lifecycle.nextAction, blockers: lifecycle.blockers ?? [], completedSteps: lifecycle.completedSteps ?? [], completedAt: lifecycle.completedAt ?? null } : null,
    run: { id: run.id, status: run.status, createdAt: run.created_at, completedAt: run.completed_at },
    timeline,
    evidenceCount: evidence?.length ?? 0,
    lastUpdatedAt: run.completed_at ?? session.updated_at,
    sessionTimeline: (turns ?? []).reverse(),
  });
}
