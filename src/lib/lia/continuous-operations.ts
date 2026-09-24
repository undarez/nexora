import type { SupabaseClient } from "@supabase/supabase-js";
import { getLiaRuntimeControls } from "@/lib/lia/runtime/controls";
import { prepareLiaWake, recordLiaWakeEpisode, type LiaWakeReason } from "@/lib/lia/autonomous-core";
import { runAutonomousGoal } from "@/lib/lia/autonomous-goal-runner";
import { runProactiveFinancialLoop } from "@/lib/lia/proactive/loop";

export type LiaContinuousOperation = "recover" | "goal" | "learn" | "observe" | "idle";

export type LiaContinuousDecision = {
  operation: LiaContinuousOperation;
  reason: LiaWakeReason;
  priority: number;
  explanation: string;
  evidence: Record<string, number | boolean>;
};

type ContinuousStats = {
  activeGoals: number;
  recentFailures: number;
  recentLearningCycles: number;
  recentProactiveRuns: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(Number.isFinite(n) ? n : min)));
}

export function decideLiaContinuousOperation(stats: ContinuousStats, controls: {
  cronAutonomyEnabled: boolean;
  webResearchEnabled: boolean;
}): LiaContinuousDecision {
  const evidence = {
    active_goals: stats.activeGoals,
    recent_failures: stats.recentFailures,
    recent_learning_cycles: stats.recentLearningCycles,
    recent_proactive_runs: stats.recentProactiveRuns,
    cron_autonomy_enabled: controls.cronAutonomyEnabled,
    web_research_enabled: controls.webResearchEnabled,
  };

  if (!controls.cronAutonomyEnabled) {
    return { operation: "idle", reason: "manual", priority: 0, explanation: "Autonomie Cron désactivée par le contrôle global.", evidence };
  }
  if (stats.recentFailures >= 2) {
    return { operation: "recover", reason: "recovery", priority: 100, explanation: "Des exécutions récentes ont échoué : la récupération bornée passe avant toute nouvelle action.", evidence };
  }
  if (stats.activeGoals > 0) {
    return { operation: "goal", reason: "goal", priority: 90, explanation: "Un objectif autonome actif doit être poursuivi avant d'ouvrir une nouvelle boucle d'apprentissage.", evidence };
  }
  if (controls.webResearchEnabled && stats.recentLearningCycles === 0) {
    return { operation: "learn", reason: "research", priority: 70, explanation: "Aucun cycle d'apprentissage récent : LIA peut lancer une recherche gouvernée et réversible.", evidence };
  }
  if (stats.recentProactiveRuns === 0) {
    return { operation: "observe", reason: "event", priority: 50, explanation: "Aucune boucle proactive récente : LIA vérifie son contexte financier avant de dormir.", evidence };
  }
  return { operation: "idle", reason: "schedule", priority: 10, explanation: "Aucune opération prioritaire détectée.", evidence };
}

function adminClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  const { createClient } = require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

async function loadStats(admin: SupabaseClient, userId: string): Promise<ContinuousStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: goals }, { count: failures }, { count: learning }, { count: proactive }] = await Promise.all([
    admin.from("agent_loop_runs").select("id,context").eq("user_id", userId).in("status", ["running", "blocked"]).limit(50),
    admin.from("agent_loop_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "failed").gte("created_at", since),
    admin.from("lia_autonomous_learning_cycles").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", week),
    admin.from("agent_loop_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("trigger_type", "proactive").gte("created_at", since),
  ]);
  const activeGoals = (goals ?? []).filter((run: { context?: Record<string, unknown> | null }) => {
    const state = String((run.context?.goal_lifecycle as Record<string, unknown> | undefined)?.state ?? "");
    return !["completed", "failed", "needs_human", "blocked"].includes(state);
  }).length;
  return {
    activeGoals,
    recentFailures: Number(failures ?? 0),
    recentLearningCycles: Number(learning ?? 0),
    recentProactiveRuns: Number(proactive ?? 0),
  };
}

async function claimWake(admin: SupabaseClient, userId: string, reason: LiaWakeReason) {
  await admin.from("lia_autonomous_wakes").update({
    status: "abandoned",
    completed_at: new Date().toISOString(),
    result: { reason: "stale_wake_reclaimed" },
  }).eq("user_id", userId).eq("status", "running").lt("started_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

  const { data, error } = await admin.from("lia_autonomous_wakes").insert({
    user_id: userId,
    reason,
    operation: "pending",
    status: "running",
    state: { phase: "waking" },
  }).select("id").single();
  if (error || !data) {
    if (/duplicate|unique/i.test(error?.message ?? "")) return null;
    throw new Error("continuous_wake_claim_failed:" + (error?.message ?? "missing_wake"));
  }
  return String(data.id);
}

async function finishWake(admin: SupabaseClient, wakeId: string, status: "completed" | "blocked" | "failed", operation: LiaContinuousOperation, result: unknown) {
  await admin.from("lia_autonomous_wakes").update({
    status,
    operation,
    result,
    completed_at: new Date().toISOString(),
    next_wake_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).eq("id", wakeId);
}

export async function runLiaContinuousCycle(args: {
  supabase: SupabaseClient;
  userId: string;
  forcedOperation?: LiaContinuousOperation;
}) {
  const admin = adminClientFromEnv();
  if (!admin) throw new Error("continuous_operations_backend_unavailable");

  const controls = await getLiaRuntimeControls(admin);
  if (!controls.cron_autonomy_enabled) {
    return { status: "blocked" as const, operation: "idle" as const, reason: "admin_global_kill_switch" };
  }

  const stats = await loadStats(admin, args.userId);
  const decision = decideLiaContinuousOperation(stats, {
    cronAutonomyEnabled: controls.cron_autonomy_enabled,
    webResearchEnabled: controls.web_research_enabled,
  });
  const operation = args.forcedOperation ?? decision.operation;
  const reason = operation === "recover" ? "recovery" : operation === "goal" ? "goal" : operation === "learn" ? "research" : operation === "observe" ? "event" : "schedule";
  const wakeId = await claimWake(admin, args.userId, reason);
  if (!wakeId) return { status: "busy" as const, operation, decision };

  try {
    const wake = await prepareLiaWake({ supabase: admin, userId: args.userId, reason, goal: operation === "goal" ? "Poursuivre les objectifs autonomes actifs." : undefined });
    if (wake.state === "blocked") {
      await finishWake(admin, wakeId, "blocked", operation, { safety: wake.safety });
      return { status: "blocked" as const, operation, decision, safety: wake.safety };
    }

    let result: unknown = { status: "idle", reason: decision.explanation };
    if (operation === "recover") {
      const [agentic, jobs] = await Promise.all([
        admin.rpc("lia_recover_agentic_state", { p_stale_minutes: 30, p_limit: 25 }),
        admin.rpc("lia_recover_stale_runtime_jobs", { p_stale_minutes: 30, p_limit: 25 }),
      ]);
      if (agentic.error) throw new Error("agentic_recovery_failed:" + agentic.error.message);
      if (jobs.error) throw new Error("runtime_recovery_failed:" + jobs.error.message);
      result = { status: "recovered", agentic: agentic.data, jobs: jobs.data };
    } else if (operation === "goal") {
      const { data: runs, error } = await admin.from("agent_loop_runs").select("id,context").eq("user_id", args.userId).in("status", ["running", "blocked"]).order("created_at", { ascending: true }).limit(8);
      if (error) throw new Error("continuous_goal_load_failed:" + error.message);
      const active = (runs ?? []).filter((run: { context?: Record<string, unknown> | null }) => {
        const state = String((run.context?.goal_lifecycle as Record<string, unknown> | undefined)?.state ?? "");
        return !["completed", "failed", "needs_human", "blocked"].includes(state);
      }).slice(0, 1);
      if (!active.length) result = { status: "no_active_goal" };
      else result = await runAutonomousGoal(admin, args.userId, String(active[0].id), 8);
    } else if (operation === "learn") {
      if (!controls.web_research_enabled) result = { status: "blocked", reason: "web_research_disabled" };
      else {
        const { runAutonomousLearningCycle } = await import("@/lib/lia/learning/autonomous");
        result = await runAutonomousLearningCycle(admin, args.userId);
      }
    } else if (operation === "observe") {
      result = await runProactiveFinancialLoop(admin, args.userId, undefined, { serverMode: true });
    }

    await recordLiaWakeEpisode({
      supabase: admin,
      userId: args.userId,
      reason,
      summary: "Opération continue " + operation + " terminée : " + JSON.stringify(result).slice(0, 1200),
      loopRunId: null,
    });
    await finishWake(admin, wakeId, "completed", operation, result);
    return { status: "completed" as const, operation, decision, result, wakeId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "continuous_cycle_failed";
    await finishWake(admin, wakeId, "failed", operation, { error: message });
    return { status: "failed" as const, operation, decision, error: message, wakeId };
  }
}

export function continuousOperationBudget(operation: LiaContinuousOperation) {
  const budgets: Record<LiaContinuousOperation, number> = { recover: 2, goal: 8, learn: 1, observe: 1, idle: 0 };
  return clamp(budgets[operation], 0, 8);
}
