import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function GET(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { data, error } = await supabase.from("agent_loop_runs")
    .select("id,status,goal,context,created_at,completed_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(12);
  if (error) {
    const missing = /schema cache|could not find the table|relation .* does not exist|PGRST205|42P01/i.test(error.message);
    if (missing) return NextResponse.json({ goals: [], degraded: true, reason: "goal_storage_unavailable" });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const goals = (data ?? []).map((row) => {
    const lifecycle = row.context?.goal_lifecycle ?? null;
    const state = lifecycle?.state ?? row.status;
    return {
      loopRunId: row.id,
      objective: lifecycle?.objective ?? row.goal,
      state,
      progress: typeof lifecycle?.progress === "number" ? lifecycle.progress : row.status === "completed" ? 100 : 0,
      currentStep: lifecycle?.currentStep ?? row.status,
      nextAction: lifecycle?.nextAction ?? "reprendre le contexte",
      blockers: Array.isArray(lifecycle?.blockers) ? lifecycle.blockers : [],
      completedAt: lifecycle?.completedAt ?? row.completed_at ?? null,
      resumable: ["running", "blocked", "needs_human"].includes(row.status) || ["blocked", "needs_human"].includes(state),
      createdAt: row.created_at,
    };
  });
  return NextResponse.json({ goals });
}
