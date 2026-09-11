import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function GET(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase n'est pas configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("loopRunId");
  if (!id) return NextResponse.json({ error: "loopRunId requis." }, { status: 400 });
  const { data, error } = await supabase.from("agent_loop_runs").select("id,status,goal,context,decision,created_at,completed_at").eq("id", id).eq("user_id", user.id).single();
  if (error || !data) return NextResponse.json({ error: "Objectif introuvable." }, { status: 404 });
  return NextResponse.json({ goal: data.context?.goal_lifecycle ?? { goalId: data.id, objective: data.goal, state: data.status, progress: data.status === "completed" ? 100 : 0 }, loopRunId: data.id, status: data.status, createdAt: data.created_at, completedAt: data.completed_at });
}
