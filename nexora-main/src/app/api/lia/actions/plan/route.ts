import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { createHumanGatedProposal, planLiaAction } from "@/lib/lia/actions/planner";
import { recordLiaGovernanceAudit } from "@/lib/lia/governance-audit";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.actionKey !== "string" || typeof body.title !== "string" || typeof body.description !== "string") return NextResponse.json({ error: "Plan d'action invalide." }, { status: 400 });
  // Server-side allow-list: the client/model cannot introduce a new action key.
  if (body.actionKey !== "create_recommendation") return NextResponse.json({ error: "Cette action n'est pas disponible via le Human Gate." }, { status: 403 });
  const { data: autonomy } = await supabase.rpc("get_lia_autonomy", { p_user_id: user.id });
  const plan = planLiaAction({ actionKey: body.actionKey, title: body.title, description: body.description, payload: typeof body.payload === "object" && body.payload ? body.payload : {}, autonomyLevel: Number(autonomy ?? 1) });
  try {
    const proposal = await createHumanGatedProposal({ supabase, userId: user.id, loopRunId: typeof body.loopRunId === "string" ? body.loopRunId : null, plan });
    try { await recordLiaGovernanceAudit(supabase, user.id, { eventType: "action_proposal_created", actor: "lia", correlationId: proposal.id, sourceRefs: { proposal_id: proposal.id, action_key: body.actionKey }, metadata: { risk_class: plan.riskClass, requires_human_approval: plan.requiresHumanApproval, mutates_financial_state: plan.riskClass === "write" || plan.riskClass === "critical" } }); } catch (error) { console.warn("Audit de gouvernance LIA indisponible:", error instanceof Error ? error.message : error); }
    return NextResponse.json({ proposal, requiresHumanApproval: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Impossible de préparer l'action." }, { status: 500 }); }
}
