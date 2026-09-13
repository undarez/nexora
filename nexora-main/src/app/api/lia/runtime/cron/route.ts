import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { nextCronRun } from "@/lib/lia/runtime/cron-scheduler";
import { runProactiveFinancialLoop } from "@/lib/lia/proactive/loop";
import { runFinancialAutopilotObservation, autoClassifyHighConfidence } from "@/lib/lia/financial-autopilot";
import { persistAutopilotSnapshot } from "@/lib/lia/financial-autopilot/persist";

export const runtime = "nodejs";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server secret missing.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function authorized(request: Request) {
  const configured = process.env.LIA_CRON_SECRET;
  if (!configured) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${configured}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Cron non autorisé." }, { status: 401 });
  try {
    const supabase = admin();
    const now = new Date();
    const { data: control, error: controlError } = await supabase.from("lia_runtime_controls").select("cron_autonomy_enabled").eq("id", 1).maybeSingle();
    if (controlError) throw new Error(controlError.message);
    if (control && control.cron_autonomy_enabled === false) {
      return NextResponse.json({ now: now.toISOString(), processed: 0, paused: true, reason: "admin_global_kill_switch" });
    }
    const { data: jobs, error } = await supabase.from("lia_runtime_jobs")
      .select("id,user_id,name,schedule,status,payload,next_run_at,last_run_at,timezone")
      .eq("runtime_type", "cron")
      .eq("status", "ready")
      .eq("admin_disabled", false)
      .not("schedule", "is", null)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`)
      .order("next_run_at", { ascending: true })
      .limit(20);
    if (error) throw new Error(error.message);

    const results: Array<Record<string, unknown>> = [];
    for (const job of jobs ?? []) {
      const schedule = String(job.schedule || "");
      let next: Date | null;
      try { next = nextCronRun(schedule, now, String(job.timezone || "UTC")); } catch (e) {
        await supabase.from("lia_runtime_jobs").update({ status: "blocked", last_status: "invalid_schedule", updated_at: now.toISOString() }).eq("id", job.id).eq("status", "ready");
        await supabase.rpc("lia_record_runtime_event", { p_user_id: job.user_id, p_runtime_type: "cron", p_event: "cron.failed", p_status: "blocked", p_runtime_job_id: job.id, p_payload: { reason: e instanceof Error ? e.message : "invalid_schedule" } });
        results.push({ job_id: job.id, status: "blocked", reason: "invalid_schedule" });
        continue;
      }

      // Claim atomically so two cron invocations cannot run the same job.
      const { data: claimed } = await supabase.from("lia_runtime_jobs").update({ status: "running", last_run_at: now.toISOString(), last_status: "running", updated_at: now.toISOString() }).eq("id", job.id).eq("status", "ready").select("id,user_id,name,payload,schedule").maybeSingle();
      if (!claimed) continue;

      await supabase.rpc("lia_record_runtime_event", { p_user_id: job.user_id, p_runtime_type: "cron", p_event: "cron.started", p_status: "running", p_runtime_job_id: job.id, p_payload: { name: job.name, schedule } });
      try {
        const action = typeof claimed.payload?.action === "string" ? claimed.payload.action : "proactive_financial_watch";
        if (!["proactive_financial_watch","goal_watch","autonomous_learning"].includes(action)) throw new Error("unsupported_cron_action");
        let result;
        if (action === "autonomous_learning") {
          const { runAutonomousLearningCycle } = await import("@/lib/lia/learning/autonomous");
          result = await runAutonomousLearningCycle(supabase, claimed.user_id);
        } else if (action === "goal_watch") {
          const { detectGoalSignals } = await import("@/lib/finance/goal-watch");
          const { data: goals, error: goalError } = await supabase.from("goals").select("id,name,target_amount,current_amount,target_date,priority").eq("user_id", claimed.user_id).limit(50);
          if (goalError) throw new Error("goal_watch_context_unavailable");
          const signals = detectGoalSignals((goals ?? []).map(g => ({ ...g, target_amount:Number(g.target_amount), current_amount:Number(g.current_amount) })));
          if (!signals.length) result = { status: "no_signal" };
          else {
            const notifications = signals.map(s => ({ user_id: claimed.user_id, type: "system", severity:s.severity, title:s.title, message:s.message, action_href:s.actionHref, dedupe_key:`goal-watch:${s.id}` }));
            const { error: notifyError } = await supabase.from("notifications").upsert(notifications,{onConflict:"user_id,dedupe_key",ignoreDuplicates:true});
            if (notifyError) throw new Error("goal_watch_notification_failed");
            result = await runProactiveFinancialLoop(supabase, claimed.user_id, signals[0].id, { serverMode: true });
          }
        } else {
          const snapshot = await runFinancialAutopilotObservation(supabase, claimed.user_id);
          const persisted = await persistAutopilotSnapshot(supabase, claimed.user_id, snapshot);
          const { data: prefs } = await supabase.from("lia_autopilot_preferences").select("enabled,auto_classify_transactions,proactive_notifications").eq("user_id", claimed.user_id).maybeSingle();
          const classification = prefs?.enabled !== false && prefs?.auto_classify_transactions !== false ? await autoClassifyHighConfidence(supabase, claimed.user_id) : { applied: 0, results: [] };
          if (prefs?.enabled !== false && prefs?.proactive_notifications !== false) {
            const notices = snapshot.opportunities.slice(0, 8).map(o => ({ user_id: claimed.user_id, type: "system", severity: o.severity, title: `LIA · ${o.title}`, message: o.message, action_href: "/pilotage#autopilot", dedupe_key: `autopilot:${o.key}` }));
            if (notices.length) { const { error: noticeError } = await supabase.from("notifications").upsert(notices, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }); if (noticeError) throw new Error("autopilot_notification_failed"); }
          }
          result = { status: "completed", autopilot: { ...persisted, classification: classification.applied, observations: snapshot.observations.length, predictions: snapshot.predictions.length } };
        }
        await supabase.from("lia_runtime_jobs").update({ status: "ready", next_run_at: next?.toISOString() ?? null, last_status: result.status, updated_at: new Date().toISOString() }).eq("id", job.id);
        await supabase.rpc("lia_record_runtime_event", { p_user_id: job.user_id, p_runtime_type: "cron", p_event: "cron.completed", p_status: "completed", p_runtime_job_id: job.id, p_payload: { result_status: result.status, next_run_at: next?.toISOString() ?? null } });
        results.push({ job_id: job.id, status: "completed", result_status: result.status, next_run_at: next?.toISOString() ?? null });
      } catch (e) {
        const message = e instanceof Error ? e.message : "cron_execution_failed";
        await supabase.from("lia_runtime_jobs").update({ status: "ready", next_run_at: next?.toISOString() ?? null, last_status: "failed", updated_at: new Date().toISOString() }).eq("id", job.id);
        await supabase.rpc("lia_record_runtime_event", { p_user_id: job.user_id, p_runtime_type: "cron", p_event: "cron.failed", p_status: "failed", p_runtime_job_id: job.id, p_payload: { error: message, next_run_at: next?.toISOString() ?? null } });
        results.push({ job_id: job.id, status: "failed", error: message });
      }
    }
    return NextResponse.json({ now: now.toISOString(), processed: results.length, results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Cron indisponible." }, { status: 503 });
  }
}
