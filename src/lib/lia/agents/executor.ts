import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { LiaPermission } from "@/lib/lia/skills/types";
import { buildLiaCommandPlan } from "../command/index.ts";
import { executeExecutableLiaSkill } from "../agent/skill-runtime.ts";
import { registerChapter7SafeSkills } from "./safe-skills.ts";
import { getLiaAgentDefinition } from "./registry.ts";
import { assertSpecialistCanRun, planSpecialistExecution } from "./runtime.ts";

export type Chapter7ExecutionContext = {
  userId: string;
  requestId?: string;
  locale?: string;
  permissions?: readonly LiaPermission[];\n  userAutonomyLevel?: number;
};

async function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

async function persistSpecialistRun(context: Chapter7ExecutionContext, plan: ReturnType<typeof buildLiaCommandPlan>, result: ReturnType<typeof planSpecialistExecution>, status: "running" | "completed" | "failed", runId?: string): Promise<{ id?: string } | null> {
  const admin = await getAdminClient();
  if (!admin) return null;
  const payload = {
    user_id: context.userId, agent_id: plan.route.agent, request_id: context.requestId ?? null, trigger_type: "user_request",
    objective: plan.intent.intent, status, risk_class: plan.policy.risk,
    confidence: Math.max(0, Math.min(1, Number(plan.intent.confidence) / 100)),
    requires_confirmation: Boolean(plan.policy.requiresConfirmation), plan: result.output,
    output: status === "running" ? {} : result.output,
    verification: result.verification,
    error_message: status === "failed" ? String(result.output.error ?? "specialist_execution_failed") : null,
    max_steps: 5, max_tool_calls: 8, max_retries: 4, max_replans: 2, max_research_requests: 3, max_memory_writes: 5,
    completed_at: status === "completed" || status === "failed" ? new Date().toISOString() : null,
  };
  const query = runId
    ? admin.from("lia_specialist_runs").update(payload).eq("id", runId).eq("user_id", context.userId).select("id").maybeSingle()
    : admin.from("lia_specialist_runs").insert(payload).select("id").single();
  const { data, error } = await query;
  if (error) return null;
  return data ? { id: String(data.id) } : null;
}

export async function executeSpecialistCommand(input: string, context: Chapter7ExecutionContext) {
  registerChapter7SafeSkills();
  const plan = buildLiaCommandPlan(input);
  const execution = planSpecialistExecution(plan);
  const agent = getLiaAgentDefinition(plan.route.agent);
  if (!agent) return execution;
  if (execution.status === "waiting_confirmation") return execution;

  try {
    assertSpecialistCanRun(plan, { permissions: context.permissions, userAutonomyLevel: context.userAutonomyLevel });
  } catch (error) {
    return { ...execution, status: "failed" as const, output: { ...execution.output, error: error instanceof Error ? error.message : String(error) }, verification: { required: true, passed: false, reason: "Gouvernance agentique bloquante." } };
  }

  const executableSpecialistSkills = new Set([
    "content-generation", "technical-seo", "system-health", "data-quality",
    "finance-analytics", "financial-reasoning", "goal-lifecycle",
    "mobility-fuel", "mobility-profile",
    "tavily-search", "tavily-research", "source-trust",
    "data-deduplication", "anomaly-detection", "system-diagnostics", "build-analysis",
  ]);
  if (!executableSpecialistSkills.has(plan.route.skill)) {
    return { ...execution, status: "planned" as const, output: { ...execution.output, next: "skill_adapter_required" } };
  }

  const permissions = context.permissions ?? [];
  const requireBackendGuards = process.env.NODE_ENV === "production" || process.env.LIA_SPECIALIST_REQUIRE_BACKEND_GUARDS === "true";
  const run = await persistSpecialistRun(context, plan, execution, "running");
  if (!run?.id && requireBackendGuards) {
    return { ...execution, status: "failed" as const, output: { ...execution.output, error: "specialist_audit_unavailable" }, verification: { required: true, passed: false, reason: "Impossible de créer le journal d'exécution spécialisé." } };
  }

  const admin = await getAdminClient();
  if (!admin && requireBackendGuards) {
    return { ...execution, status: "failed" as const, output: { ...execution.output, error: "specialist_budget_unavailable" }, verification: { required: true, passed: false, reason: "Le budget d'autonomie spécialisé nécessite le client backend." } };
  }

  if (!run?.id || !admin) {
    const output = await executeExecutableLiaSkill(plan.route.skill, { text: input }, { userId: context.userId, requestId: context.requestId, locale: context.locale, permissions });
    return { ...execution, status: "completed" as const, output: { ...execution.output, result: output }, verification: { required: true, passed: true, reason: "Skill exécuté et vérifié par le skill runtime." } };
  }

  const consume = async (dimension: string) => {
    const { data, error } = await admin.rpc("lia_consume_specialist_budget", { p_run_id: run.id, p_user_id: context.userId, p_dimension: dimension, p_amount: 1 });
    if (error) throw new Error("specialist_budget_unavailable: " + error.message);
    return data as { allowed?: boolean; reason?: string; dimension?: string; used?: number; limit?: number; remaining?: number };
  };

  try {
    if ((await consume("steps")).allowed !== true) throw new Error("specialist_budget_exhausted:steps");
    if ((await consume("tool_calls")).allowed !== true) throw new Error("specialist_budget_exhausted:tool_calls");
    const output = await executeExecutableLiaSkill(plan.route.skill, { text: input }, { userId: context.userId, requestId: context.requestId, locale: context.locale, permissions });
    const completed = { ...execution, status: "completed" as const, output: { ...execution.output, result: output }, verification: { required: true, passed: true, reason: "Skill exécuté et vérifié par le skill runtime." } };
    await persistSpecialistRun(context, plan, completed, "completed", run.id);
    return completed;
  } catch (error) {
    const failed = { ...execution, status: "failed" as const, output: { ...execution.output, error: error instanceof Error ? error.message : String(error) }, verification: { required: true, passed: false, reason: "Échec d'exécution, de gouvernance ou de vérification du skill." } };
    await persistSpecialistRun(context, plan, failed, "failed", run.id);
    return failed;
  }
}
