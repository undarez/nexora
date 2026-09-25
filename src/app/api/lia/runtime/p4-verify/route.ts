import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server secret missing.");
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

function authorized(request: Request) {
  const configured = process.env.LIA_CRON_SECRET || process.env.CRON_SECRET;
  return Boolean(configured && request.headers.get("authorization") === `Bearer ${configured}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "P4 verification non autorisée." }, { status: 401 });

  try {
    const supabase = admin();
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 20, 0, 0));
    const jobResult = await supabase
      .from("lia_runtime_jobs")
      .select("id,user_id,name,status,next_run_at,last_run_at,last_status,last_error,failure_count,payload")
      .eq("name", "LIA · Opérations continues")
      .maybeSingle();

    if (jobResult.error) throw new Error(`p4_verification_job_load_failed:${jobResult.error.message}`);
    const job = jobResult.data;
    if (!job) return NextResponse.json({ status: "failed", reason: "p4_job_not_found" }, { status: 503 });

    const wakeResult = await supabase
      .from("lia_autonomous_wakes")
      .select("id,reason,operation,status,started_at,completed_at,result")
      .eq("user_id", job.user_id)
      .gte("started_at", dayStart.toISOString())
      .order("started_at", { ascending: false })
      .limit(5);

    if (wakeResult.error) throw new Error(`p4_verification_wake_load_failed:${wakeResult.error.message}`);

    const latestWake = wakeResult.data?.[0] ?? null;
    const executed = Boolean(job.last_run_at && new Date(job.last_run_at).getTime() >= dayStart.getTime());
    const wakeConfirmed = Boolean(latestWake?.started_at && new Date(latestWake.started_at).getTime() >= dayStart.getTime());
    const verified = executed && wakeConfirmed;

    const eventPayload = {
      verified,
      executed,
      wake_confirmed: wakeConfirmed,
      checked_at: now.toISOString(),
      scheduled_window: dayStart.toISOString(),
      job: {
        last_run_at: job.last_run_at,
        last_status: job.last_status,
        last_error: job.last_error,
        failure_count: job.failure_count,
      },
      wake: latestWake,
    };

    await supabase.from("lia_runtime_events").insert({
      user_id: job.user_id,
      runtime_job_id: job.id,
      runtime_type: "cron",
      event: "continuous_operations.verification",
      status: verified ? "completed" : "failed",
      payload: eventPayload,
    });

    if (!verified) {
      await supabase.from("notifications").upsert({
        user_id: job.user_id,
        type: "system",
        severity: "warning",
        title: "LIA · Réveil P4 à vérifier",
        message: executed
          ? "Le cron P4 a été exécuté, mais aucun réveil LIA correspondant n’a été confirmé."
          : "Le cron P4 n’a pas encore fourni de trace d’exécution pour la fenêtre du jour.",
        action_href: "/pilotage",
        dedupe_key: `lia-p4-verification:${dayStart.toISOString().slice(0, 10)}`,
      }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
    }

    return NextResponse.json({
      status: verified ? "verified" : "not_verified",
      executed,
      wakeConfirmed,
      operation: latestWake?.operation ?? null,
      wakeStatus: latestWake?.status ?? null,
      checkedAt: now.toISOString(),
    }, { status: verified ? 200 : 409 });
  } catch (error) {
    return NextResponse.json({
      status: "failed",
      error: error instanceof Error ? error.message : "p4_verification_failed",
    }, { status: 503 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
