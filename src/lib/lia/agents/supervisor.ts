import { createClient as createAdminClient } from "@supabase/supabase-js";
import { executeSpecialistCommand } from "./executor.ts";
import { getLiaAgentDefinition } from "./registry.ts";
import type { LiaMissionOptions, LiaMissionResult, LiaMissionTask, LiaMissionEvidence } from "./supervisor-types.ts";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

const TASK_RULES = [
  { test: /dépense|depense|budget|finance|argent|solde|transaction/i, agentId: "finance", skillId: "financial-reasoning", intent: "finance.spending.analyze", suffix: "Analyse les dépenses et flux financiers pertinents." },
  { test: /carburant|essence|gazole|trajet|kilométrage|kilometrage|moto|voiture|véhicule|vehicule/i, agentId: "mobility", skillId: "mobility-fuel", intent: "mobility.fuel.read", suffix: "Analyse les coûts de mobilité et carburant." },
  { test: /recherche|cherche|actualité|actualite|source|veille|internet/i, agentId: "research", skillId: "tavily-search", intent: "research.search", suffix: "Recherche les informations externes nécessaires." },
  { test: /doublon|anomalie|qualité des données|qualite des donnees|données|donnees/i, agentId: "data", skillId: "data-quality", intent: "data.quality_check", suffix: "Contrôle qualité, cohérence et anomalies." },
  { test: /erreur|bug|build|déploiement|deploiement|système|systeme|vercel/i, agentId: "system-admin", skillId: "system-diagnostics", intent: "system.diagnostics", suffix: "Diagnostique les signaux techniques." },
  { test: /seo|référencement|referencement|keyword|mots-clés|mots-cles/i, agentId: "seo", skillId: "technical-seo", intent: "seo.audit", suffix: "Audite les éléments SEO." },
  { test: /email|mail|message|texte|contenu|rédige|redige/i, agentId: "copywriting", skillId: "content-generation", intent: "copywriting.generate", suffix: "Traite le contenu sans publication implicite." },
];

function planMission(objective: string): LiaMissionTask[] {
  const selected = TASK_RULES.filter((rule) => rule.test.test(objective));
  const rules = selected.length ? selected : [TASK_RULES[0]];
  return rules.map((rule, index) => ({
    id: rule.agentId + "-" + (index + 1),
    intent: rule.intent,
    input: objective + "\n\nSous-mission: " + rule.suffix,
    agentId: rule.agentId,
    skillId: rule.skillId,
    dependsOn: index === 0 ? [] : [rules[0].agentId + "-1"],
  }));
}

function fallback(skill: string) {
  const map = {
    "financial-reasoning": "finance-analytics",
    "tavily-search": "source-trust",
    "data-quality": "anomaly-detection",
    "system-diagnostics": "system-health",
    "technical-seo": "keyword-analysis",
    "content-generation": "ux-copy",
    "mobility-fuel": "mobility-profile",
  } as Record<string, string>;
  return map[skill] ?? null;
}

async function consume(admin: ReturnType<typeof adminClient>, runId: string, userId: string, dimension: string) {
  if (!admin) return true;
  const { data, error } = await admin.rpc("lia_consume_orchestration_budget", { p_run_id: runId, p_user_id: userId, p_dimension: dimension, p_amount: 1 });
  return !error && Boolean((data as { allowed?: boolean } | null)?.allowed);
}

export async function runAutonomousMission(objective: string, context: { userId: string; requestId?: string; locale?: string; permissions?: readonly import("@/lib/lia/skills/types").LiaPermission[] }, options: LiaMissionOptions = {}): Promise<LiaMissionResult> {
  const tasks = planMission(objective);
  const maxSteps = Math.max(1, Math.min(10, options.maxSteps ?? tasks.length));
  const maxReplans = Math.max(0, Math.min(2, options.maxReplans ?? 1));
  const admin = adminClient();

  let missionId: string | undefined;
  if (admin) {
    const run = await admin.from("lia_orchestration_runs").insert({
      user_id: context.userId, objective, status: "running", max_steps: maxSteps,
      context: { trigger: "chapter7_p2_supervisor", request_id: context.requestId ?? null }, result: {},
    }).select("id").single();
    if (run.error || !run.data) return { status: "failed", objective, tasks, evidence: [], replans: [], critique: { passed: false, reasons: ["orchestration_run_unavailable"] }, memoryWritten: false, output: {} };
    missionId = String(run.data.id);
    const budget = await admin.from("lia_orchestration_budgets").insert({
      run_id: missionId, user_id: context.userId, max_steps: maxSteps, max_tool_calls: 8,
      max_retries: 4, max_replans: maxReplans, max_research_requests: 3, max_memory_writes: 5, max_runtime_ms: 30000,
    });
    if (budget.error) return { status: "failed", missionId, objective, tasks, evidence: [], replans: [], critique: { passed: false, reasons: ["orchestration_budget_unavailable"] }, memoryWritten: false, output: {} };
  }

  const evidence: LiaMissionEvidence[] = [];
  const replans: LiaMissionResult["replans"] = [];

  for (let i = 0; i < tasks.length && i < maxSteps; i++) {
    const task = tasks[i];
    if (missionId && (!(await consume(admin, missionId, context.userId, "steps")) || !(await consume(admin, missionId, context.userId, "tool_calls")))) break;
    if (!getLiaAgentDefinition(task.agentId)) {
      evidence.push({ taskId: task.id, agentId: task.agentId, skillId: task.skillId, status: "failed", verification: { passed: false }, output: { error: "agent_not_found" } });
      continue;
    }

    let actual = task;
    let result = await executeSpecialistCommand(task.input, context);
    if (result.status === "failed" && missionId && replans.length < maxReplans) {
      const alternative = fallback(task.skillId);
      const agent = getLiaAgentDefinition(task.agentId);
      if (alternative && agent?.skills.includes(alternative) && await consume(admin, missionId, context.userId, "replans")) {
        replans.push({ reason: String(result.output?.error ?? "specialist_failed"), fromTask: task.id, toSkill: alternative });
        actual = { ...task, skillId: alternative };
        result = await executeSpecialistCommand(task.input + "\nReplan contrôlé: utiliser " + alternative + ".", context);
      }
    }

    const item = { taskId: actual.id, agentId: actual.agentId, skillId: actual.skillId, status: result.status, verification: result.verification, output: result.output };
    evidence.push(item);
    if (missionId) {
      await admin.from("lia_orchestration_steps").insert({
        run_id: missionId, step_index: i + 1, objective: actual.input, status: result.status,
        risk_class: "read", human_gate_required: result.status === "waiting_confirmation",
        verification_rules: [{ required: true }], input_context: { task: actual },
        output_context: result.output, agent_key: actual.agentId,
        execution_policy: { governed: true, supervisor: true },
        handoff_context: { from: "supervisor", to: actual.agentId, task_id: actual.id },
        evidence_refs: [result.verification],
      });
    }
  }

  const failed = evidence.filter((e) => e.status === "failed");
  const waiting = evidence.filter((e) => e.status === "waiting_confirmation");
  const critiqueReasons = [
    ...failed.map((e) => e.taskId + ": execution_failed"),
    ...evidence.filter((e) => (e.verification as { passed?: boolean } | null)?.passed === false).map((e) => e.taskId + ": verification_failed"),
  ];
  const critique = { passed: critiqueReasons.length === 0, reasons: critiqueReasons };
  let memoryWritten = false;

  if (admin && critique.passed && evidence.length) {
    const agents = [...new Set(evidence.map((e) => e.agentId))];
    memoryWritten = true;
    for (const agentId of agents) {
      const existing = await admin.from("lia_specialist_work_memory").select("memory").eq("user_id", context.userId).eq("agent_id", agentId).maybeSingle();
      const previous = existing.data?.memory && typeof existing.data.memory === "object" ? existing.data.memory as Record<string, unknown> : {};
      const history = Array.isArray(previous.history) ? previous.history : [];
      const write = await admin.from("lia_specialist_work_memory").upsert({
        user_id: context.userId, agent_id: agentId,
        memory: { ...previous, history: [...history, { at: new Date().toISOString(), missionId, evidence: evidence.filter((e) => e.agentId === agentId).map((e) => ({ taskId: e.taskId, status: e.status, verification: e.verification })) }].slice(-20) },
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,agent_id" });
      if (write.error) memoryWritten = false;
    }
  }

  const status = waiting.length ? "waiting_confirmation" : failed.length ? (evidence.length > failed.length ? "partial" : "failed") : "completed";
  const result: LiaMissionResult = {
    status, missionId, objective, tasks, evidence, replans, critique, memoryWritten,
    output: { completedTasks: evidence.filter((e) => e.status === "completed").length, failedTasks: failed.length, pendingConfirmation: waiting.length },
  };
  if (admin && missionId) await admin.from("lia_orchestration_runs").update({ status, result, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", missionId);
  return result;
}
