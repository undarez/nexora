import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { buildLiaOrchestrationPlan, persistLiaOrchestrationPlan } from "@/lib/lia/orchestrator";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 });
  }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.objective !== "string" || !body.objective.trim()) {
    return NextResponse.json({ error: "Objectif invalide." }, { status: 400 });
  }

  const maxSteps = typeof body.max_steps === "number" ? body.max_steps : 5;
  try {
    const plan = await buildLiaOrchestrationPlan({
      supabase,
      userId: user.id,
      objective: body.objective,
      maxSteps,
    });
    const persisted = await persistLiaOrchestrationPlan({ supabase, userId: user.id, plan });
    if (persisted.run?.id) {
      await supabase.from("lia_orchestration_runs").update({
        context: {
          bounded: true,
          planning_only: true,
          strategy_key: plan.strategyKey,
          strategy_context_key: plan.strategyContextKey,
          use_case_id: plan.useCase?.use_case_id ?? null,
          success_criteria: Array.isArray(body.success_criteria) ? body.success_criteria.slice(0, 8) : (plan.useCase?.success_criteria ?? []).slice(0, 8),
        },
      }).eq("id", persisted.run.id).eq("user_id", user.id);
    }
    return NextResponse.json({
      ...persisted,
      useCase: plan.useCase,
      candidateUseCase: plan.candidateUseCase,
      skills: plan.skills,
      governance: plan.governance,
      plan: {
        status: plan.status,
        reason: plan.reason,
        objective: plan.objective,
        max_steps: plan.maxSteps,
        useCase: plan.useCase,
        skills: plan.skills,
        governance: plan.governance,
        strategy_key: plan.strategyKey,
        strategy_context_key: plan.strategyContextKey,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Impossible de construire l'orchestration." }, { status: 500 });
  }
}
