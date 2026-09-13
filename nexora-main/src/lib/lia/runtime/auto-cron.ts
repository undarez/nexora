import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { nextCronRun } from "@/lib/lia/runtime/cron-scheduler";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** LIA decides whether a user needs scheduled surveillance and autonomous learning. */
export async function ensureLiaAutonomousCron(supabase: SupabaseClient, userId: string) {
  const admin = adminClient();
  if (!admin) return { status: "degraded" as const, reason: "server_secret_missing" };

  const { data: jobs, error: jobsError } = await admin.from("lia_runtime_jobs")
    .select("id,name,status,schedule,payload,next_run_at,updated_at,admin_disabled")
    .eq("user_id", userId).eq("runtime_type", "cron").limit(30);
  if (jobsError) return { status: "degraded" as const, reason: "runtime_storage_unavailable" };

  const { data: control } = await admin.from("lia_runtime_controls").select("cron_autonomy_enabled").eq("id", 1).maybeSingle();
  if (control?.cron_autonomy_enabled === false) return { status: "paused" as const, reason: "admin_global_kill_switch" };

  const allJobs = jobs ?? [];
  const managedJobs = allJobs.filter(job => typeof job.payload?.action === "string" && job.payload.action === "proactive_financial_watch");
  const learningJobs = allJobs.filter(job => typeof job.payload?.action === "string" && job.payload.action === "autonomous_learning");
  const adminBlocked = managedJobs.find(job => job.admin_disabled);
  if (adminBlocked) return { status: "admin_blocked" as const, jobId: adminBlocked.id };

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: transactions }, { count: runs }, { count: goals }] = await Promise.all([
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("occurred_at", since),
    supabase.from("agent_loop_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase.from("goals").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const activity = Number(transactions ?? 0) + Number(runs ?? 0);
  const hasFinancialContext = activity > 0 || Number(goals ?? 0) > 0;
  let surveillanceJobId: string | null = null;
  let surveillanceCreated = false;

  // Financial surveillance is demand-based: it only wakes when there is useful
  // financial context, keeping the system economical for dormant accounts.
  if (hasFinancialContext) {
    const schedule = activity >= 20 ? "0 8 * * *" : "0 8 * * 1";
    const existing = managedJobs.find(job => ["ready", "running"].includes(job.status));
    surveillanceJobId = existing?.id ?? null;

    if (existing && existing.schedule !== schedule) {
      await admin.from("lia_runtime_jobs").update({ status: "paused", last_status: "replaced_by_usage_policy", updated_at: new Date().toISOString() }).eq("id", existing.id);
      surveillanceJobId = null;
    } else if (existing && !existing.next_run_at) {
      const nextRun = nextCronRun(schedule, new Date(), "Europe/Paris")?.toISOString() ?? null;
      if (nextRun) await admin.from("lia_runtime_jobs").update({ next_run_at: nextRun, updated_at: new Date().toISOString() }).eq("id", existing.id);
    }

    if (!surveillanceJobId) {
      const expectedName = activity >= 20 ? "LIA · Surveillance quotidienne" : "LIA · Surveillance hebdomadaire";
      const { data: job, error } = await admin.from("lia_runtime_jobs").insert({
        user_id: userId, runtime_type: "cron", name: expectedName,
        description: "Planification adaptative gérée automatiquement par LIA selon l'utilisation de l'application.",
        schedule, status: "ready",
        next_run_at: nextCronRun(schedule, new Date(), "Europe/Paris")?.toISOString() ?? null,
        payload: { action: "proactive_financial_watch", execution_mode: "agent", managed_by: "lia", adaptive: true },
        requires_policy_gate: true, requires_human_approval: true, timezone: "Europe/Paris", execution_mode: "agent",
      }).select("id,schedule").single();
      if (error || !job) return { status: "degraded" as const, reason: error?.message ?? "cron_create_failed" };
      surveillanceJobId = job.id;
      surveillanceCreated = true;
      await admin.from("lia_runtime_events").insert({
        user_id: userId, runtime_job_id: job.id, runtime_type: "cron", event: "cron.scheduled", status: "completed",
        payload: { schedule, managed_by: "lia", adaptive: true, activity_30d: activity, transactions_30d: Number(transactions ?? 0), runs_30d: Number(runs ?? 0), goals: Number(goals ?? 0) },
      });
    }
  }

  // Autonomous learning is intentionally independent from financial activity.
  // It is read/research only and can therefore keep improving LIA's knowledge
  // even for a new user with no transactions yet. Weekly is the default to stay economical.
  const learningExisting = learningJobs.find(job => ["ready", "running"].includes(job.status));
  let learningScheduled = Boolean(learningExisting);
  let learningCreated = false;
  if (learningExisting) {
    const learningSchedule = String(learningExisting.schedule || "30 8 * * 1");
    if (!learningExisting.next_run_at) {
      const nextRun = nextCronRun(learningSchedule, new Date(), "Europe/Paris")?.toISOString() ?? null;
      if (nextRun) await admin.from("lia_runtime_jobs").update({ next_run_at: nextRun, updated_at: new Date().toISOString() }).eq("id", learningExisting.id);
    }
  } else {
    const learningSchedule = "30 8 * * 1";
    const { data: learningJob, error: learningError } = await admin.from("lia_runtime_jobs").insert({
      user_id: userId, runtime_type: "cron", name: "LIA · Apprentissage hebdomadaire",
      description: "Boucle autonome de recherche, vérification et apprentissage borné de LIA.",
      schedule: learningSchedule, status: "ready",
      next_run_at: nextCronRun(learningSchedule, new Date(), "Europe/Paris")?.toISOString() ?? null,
      payload: { action: "autonomous_learning", execution_mode: "agent", managed_by: "lia", adaptive: true, financial_writes_allowed: false, trusted_domains_only: true },
      requires_policy_gate: true, requires_human_approval: false, timezone: "Europe/Paris", execution_mode: "agent",
    }).select("id,schedule").single();
    if (!learningError && learningJob) {
      learningScheduled = true;
      learningCreated = true;
      await admin.from("lia_runtime_events").insert({
        user_id: userId, runtime_job_id: learningJob.id, runtime_type: "cron", event: "cron.scheduled", status: "completed",
        payload: { schedule: learningSchedule, managed_by: "lia", purpose: "autonomous_learning", trusted_domains_only: true },
      });
    }
  }

  return {
    status: surveillanceCreated || learningCreated ? "created" as const : "unchanged" as const,
    jobId: surveillanceJobId,
    schedule: hasFinancialContext ? (activity >= 20 ? "0 8 * * *" : "0 8 * * 1") : null,
    learningScheduled,
    learningCreated,
    surveillanceCreated,
  };
}
