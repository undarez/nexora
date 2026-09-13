import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";

const ALLOWED = new Set(["transactions", "budget_scenarios", "accounts", "wealth_entries", "forecast_inputs"]);
const EVENTS = new Set(["INSERT", "UPDATE", "DELETE"]);

type Intervention = { key: string; title: string; message: string; href: string; actionLabel: string; risk: "low" | "medium" };

function buildIntervention(table: string, event: string): Intervention {
  if (table === "transactions" && event === "INSERT") return { key: "transaction-new", title: "Nexo a remarqué une nouvelle dépense", message: "Je peux vérifier son impact sur votre budget et vos enveloppes.", href: "/transactions", actionLabel: "Voir la dépense", risk: "low" };
  if (table === "transactions") return { key: "transaction-changed", title: "Nexo a remarqué une modification", message: "Je peux vérifier si cette opération change vos prévisions.", href: "/transactions", actionLabel: "Vérifier", risk: "low" };
  if (table === "budget_scenarios") return { key: "budget-changed", title: "Votre budget vient de changer", message: "Je peux recalculer la marge et rechercher une dérive.", href: "/budget", actionLabel: "Analyser", risk: "low" };
  if (table === "forecast_inputs") return { key: "forecast-changed", title: "Une prévision vient de changer", message: "Je peux comparer cette hypothèse avec les résultats observés.", href: "/previsions", actionLabel: "Comparer", risk: "low" };
  if (table === "wealth_entries") return { key: "wealth-changed", title: "Votre patrimoine a évolué", message: "Je peux vérifier l'impact sur votre trajectoire patrimoniale.", href: "/patrimoine", actionLabel: "Voir", risk: "low" };
  return { key: "account-changed", title: "Un compte vient de changer", message: "Je peux vérifier que votre situation de trésorerie reste cohérente.", href: "/banque", actionLabel: "Vérifier", risk: "medium" };
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { table?: string; event?: string } = {};
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const table = String(body.table ?? "");
  const event = String(body.event ?? "").toUpperCase();
  if (!ALLOWED.has(table) || !EVENTS.has(event)) return NextResponse.json({ ok: false, error: "event_not_allowed" }, { status: 400 });

  const intervention = buildIntervention(table, event);
  const dedupeKey = `${intervention.key}:${new Date().toISOString().slice(0, 13)}`;
  const { data: existing } = await supabase.from("lia_interventions").select("id,title,message,href,action_label,risk,status").eq("user_id", user.id).eq("dedupe_key", dedupeKey).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, intervention: existing, deduped: true });

  const { data: loop, error: loopError } = await supabase.from("agent_loop_runs").insert({ user_id: user.id, trigger_type: "proactive", status: "running", goal: intervention.message, context: { source: "realtime", table, event, intervention_key: intervention.key } }).select("id").single();
  if (loopError || !loop) return NextResponse.json({ ok: false, error: loopError?.message ?? "loop_create_failed" }, { status: 500 });

  const { error: stepError } = await supabase.from("agent_loop_steps").insert({ loop_run_id: loop.id, step_order: 1, agent_key: "lia-active-loop", status: "completed", input: { table, event }, output: { intervention: intervention.key }, duration_ms: 0 });
  if (stepError) return NextResponse.json({ ok: false, error: stepError.message }, { status: 500 });

  const { data, error } = await supabase.from("lia_interventions").insert({ user_id: user.id, loop_run_id: loop.id, dedupe_key: dedupeKey, event_source: table, event_type: event, title: intervention.title, message: intervention.message, href: intervention.href, action_label: intervention.actionLabel, risk: intervention.risk, status: "proposed" }).select("id,title,message,href,action_label,risk,status").single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "intervention_create_failed" }, { status: 500 });

  await supabase.from("agent_loop_runs").update({ status: "completed", decision: { type: "propose", intervention_id: data.id, risk: intervention.risk }, completed_at: new Date().toISOString() }).eq("id", loop.id);
  return NextResponse.json({ ok: true, intervention: data, deduped: false });
}
