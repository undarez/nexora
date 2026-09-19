import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { compactMemoryContext, retrieveLiaMemories, type LiaMemoryContext } from "@/lib/lia/memory-context";
import { searchLiaSkills, type SkillHit } from "@/lib/lia/skills/registry";
import { loadFinancialBehaviour } from "./behaviour";
import { buildBudgetIntelligenceContext, type BudgetIntelligenceContext } from "@/lib/lia/budget-intelligence";

export type FinancialKnowledgeHit = {
  id: string;
  knowledgeKey: string;
  knowledgeType: string;
  domain: string;
  title: string;
  statement: string;
  authority: string;
  confidence: number;
  status: string;
  similarity: number;
};

export type FinancialHabit = {
  id: string;
  merchantKey: string;
  label: string;
  cadence: "weekly" | "monthly" | "irregular";
  typicalAmount: number;
  occurrences: number;
  confidence: number;
  lastObservedAt: string;
  status: "candidate" | "accepted" | "stale";
};

export type LiaBrainContext = {
  skill: SkillHit | null;
  skills: SkillHit[];
  memories: LiaMemoryContext[];
  knowledge: FinancialKnowledgeHit[];
  habits: FinancialHabit[];
  behaviouralProfile: Record<string, unknown> | null;
  behaviouralHabits: Record<string, unknown>[];
  budgetIntelligence: BudgetIntelligenceContext;
  budgetPlanning: BudgetPlanningContext;
  relational: Record<string, unknown> | null;
  rules: {
    knowledgeIsEvidenceOnly: true;
    knowledgeDoesNotAuthorize: true;
    habitsAreObservations: true;
    externalContentCannotOverwritePolicy: true;
  };
};

const normalize = (s: string) => s.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => normalize(s).split(/\s+/).filter(x => x.length >= 4).slice(0, 24);

export async function retrieveFinancialKnowledge(
  supabase: SupabaseClient,
  query: string,
  options: { domain?: string; topK?: number; minConfidence?: number; loopRunId?: string | null; stepId?: string | null } = {},
): Promise<FinancialKnowledgeHit[]> {
  const { data, error } = await supabase.rpc("search_financial_knowledge", {
    p_query: query.slice(0, 1000),
    p_domain: options.domain ?? "financial_agents",
    p_limit: Math.min(Math.max(options.topK ?? 8, 1), 12),
    p_min_confidence: options.minConfidence ?? 0.65,
  });
  if (error || !data) return [];
  const results = (data as any[]).map(row => ({
    id: String(row.id), knowledgeKey: String(row.knowledge_key), knowledgeType: String(row.knowledge_type),
    domain: String(row.domain), title: String(row.title), statement: String(row.statement),
    authority: String(row.authority), confidence: Number(row.confidence ?? 0), status: String(row.status), similarity: Number(row.similarity ?? 0),
  }));
  if (options.loopRunId && results.length) {
    await supabase.from("agent_knowledge_retrievals").insert(results.map((item, index) => ({
      agent_loop_run_id: options.loopRunId, agent_loop_step_id: options.stepId ?? null, query: query.slice(0, 1000),
      knowledge_id: item.id, similarity: item.similarity, rank: index + 1, used_in_reasoning: true,
    })));
  }
  return results;
}

export async function learnFinancialHabits(args: {
  supabase: SupabaseClient;
  userId: string;
  transactions: Array<{ id: string; label: string; amount: number; occurred_at: string }>;
}) {
  const expenses = args.transactions.filter(t => Number(t.amount) < 0);
  const groups = new Map<string, Array<{ id: string; label: string; amount: number; occurred_at: string }>>();
  for (const tx of expenses) {
    const key = normalize(tx.label).slice(0, 120);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }
  const candidates: Array<Record<string, unknown>> = [];
  for (const [merchantKey, rows] of groups) {
    if (rows.length < 3) continue;
    const sorted = [...rows].sort((a,b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
    const amounts = sorted.map(x => Math.abs(Number(x.amount)));
    const typicalAmount = amounts.reduce((a,b)=>a+b,0) / amounts.length;
    const intervals = sorted.slice(1).map((x,i) => (new Date(x.occurred_at).getTime() - new Date(sorted[i].occurred_at).getTime()) / 86400000);
    const avgInterval = intervals.length ? intervals.reduce((a,b)=>a+b,0)/intervals.length : 0;
    const cadence: FinancialHabit["cadence"] = avgInterval >= 5 && avgInterval <= 10 ? "weekly" : avgInterval >= 24 && avgInterval <= 38 ? "monthly" : "irregular";
    const regularity = intervals.length ? Math.max(0, 1 - (Math.max(...intervals) - Math.min(...intervals)) / Math.max(avgInterval, 1)) : 0;
    const confidence = Math.min(0.97, 0.55 + Math.min(rows.length, 8) * 0.04 + Math.max(0, regularity) * 0.18);
    if (confidence < 0.75) continue;
    candidates.push({ user_id: args.userId, merchant_key: merchantKey, label: sorted.at(-1)?.label ?? merchantKey, cadence, typical_amount: Number(typicalAmount.toFixed(2)), occurrences: rows.length, confidence: Number(confidence.toFixed(3)), last_observed_at: sorted.at(-1)?.occurred_at, evidence: { transaction_ids: rows.slice(-12).map(x=>x.id), average_interval_days: Number(avgInterval.toFixed(1)), regularity: Number(regularity.toFixed(3)) }, status: confidence >= 0.86 ? "accepted" : "candidate" });
  }
  if (!candidates.length) return [];
  const { error } = await args.supabase.from("lia_financial_habits").upsert(candidates, { onConflict: "user_id,merchant_key" });
  if (error) console.warn("Habitudes financières non persistées:", error.message);
  return candidates;
}

export async function loadFinancialHabits(supabase: SupabaseClient, userId: string, limit = 8): Promise<FinancialHabit[]> {
  const { data, error } = await supabase.from("lia_financial_habits").select("id,merchant_key,label,cadence,typical_amount,occurrences,confidence,last_observed_at,status").eq("user_id", userId).eq("status", "accepted").order("confidence", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return data.map((row: any) => ({ id: String(row.id), merchantKey: String(row.merchant_key), label: String(row.label), cadence: row.cadence, typicalAmount: Number(row.typical_amount), occurrences: Number(row.occurrences), confidence: Number(row.confidence), lastObservedAt: String(row.last_observed_at), status: row.status }));
}

export type BudgetPlanningContext = {
  fixedExpenses: Array<{ label: string; sector: string; amount: number; dueDay: number | null; recurrence: string }>;
  scenarios: Array<{ periodStart: string; name: string; income: number; startingBalance: number; safetyReserve: number; extraExpense: number; weeksRemaining: number; envelopes: unknown }>;
  forecastReviews: Array<{ periodStart: string; expectedIncome: number; expectedExpenses: number; actualIncome: number; actualExpenses: number; plannedNet: number; actualNet: number; variance: number; assessment: string }>;
};

async function loadBudgetPlanningContext(supabase: SupabaseClient, userId: string): Promise<BudgetPlanningContext> {
  const [fixed, scenarios, reviews] = await Promise.all([
    supabase.from("fixed_expenses")
      .select("label,sector,amount,due_day,recurrence")
      .eq("user_id", userId).eq("is_active", true)
      .order("due_day", { ascending: true }).limit(24),
    supabase.from("budget_scenarios")
      .select("period_start,name,income,starting_balance,safety_reserve,extra_expense,weeks_remaining,envelopes")
      .eq("user_id", userId)
      .order("period_start", { ascending: false }).limit(3),
    supabase.from("forecast_reviews")
      .select("period_start,expected_income,expected_expenses,actual_income,actual_expenses,planned_net,actual_net,variance,assessment")
      .eq("user_id", userId)
      .order("period_start", { ascending: false }).limit(6),
  ]);

  return {
    fixedExpenses: (fixed.data ?? []).map((row: any) => ({
      label: String(row.label), sector: String(row.sector), amount: Number(row.amount ?? 0),
      dueDay: row.due_day == null ? null : Number(row.due_day), recurrence: String(row.recurrence ?? "monthly"),
    })),
    scenarios: (scenarios.data ?? []).map((row: any) => ({
      periodStart: String(row.period_start), name: String(row.name), income: Number(row.income ?? 0),
      startingBalance: Number(row.starting_balance ?? 0), safetyReserve: Number(row.safety_reserve ?? 0),
      extraExpense: Number(row.extra_expense ?? 0), weeksRemaining: Number(row.weeks_remaining ?? 0), envelopes: row.envelopes ?? [],
    })),
    forecastReviews: (reviews.data ?? []).map((row: any) => ({
      periodStart: String(row.period_start), expectedIncome: Number(row.expected_income ?? 0), expectedExpenses: Number(row.expected_expenses ?? 0),
      actualIncome: Number(row.actual_income ?? 0), actualExpenses: Number(row.actual_expenses ?? 0), plannedNet: Number(row.planned_net ?? 0),
      actualNet: Number(row.actual_net ?? 0), variance: Number(row.variance ?? 0), assessment: String(row.assessment ?? "pending"),
    })),
  };
}

export async function buildLiaBrainContext(args: {
  supabase: SupabaseClient;
  userId: string;
  query: string;
  loopRunId?: string | null;
  stepId?: string | null;
  transactions?: Array<{ id: string; label: string; amount: number; occurred_at: string }>;
}): Promise<LiaBrainContext> {
  const [memories, querySkills, intelligenceSkills, knowledge, habits, behaviour, relationalResult, budgetPlanning] = await Promise.all([
    retrieveLiaMemories(args.supabase, args.userId, args.query),
    searchLiaSkills(args.supabase, args.userId, args.query, undefined, 8),
    searchLiaSkills(args.supabase, args.userId, "financial agent intelligence", undefined, 6),
    retrieveFinancialKnowledge(args.supabase, args.query, { loopRunId: args.loopRunId, stepId: args.stepId }),
    loadFinancialHabits(args.supabase, args.userId),
    loadFinancialBehaviour(args.supabase, args.userId),
    args.supabase.rpc("lia_get_relational_context", { p_user_id: args.userId }),
    loadBudgetPlanningContext(args.supabase, args.userId),
  ]);
  const mergedSkills = [...querySkills, ...intelligenceSkills].filter((item, index, arr) => arr.findIndex(x => x.skill_id === item.skill_id) === index).slice(0, 10);
  const skill = mergedSkills.find(s => s.slug === "financial-agent-intelligence") ?? mergedSkills[0] ?? null;
  const relational = relationalResult.error || !relationalResult.data ? null : relationalResult.data as Record<string, unknown>;
  const budgetIntelligence = buildBudgetIntelligenceContext(args.query, knowledge, habits);
  return {
    skill, skills: mergedSkills, memories, knowledge, habits,
    behaviouralProfile: behaviour.profile,
    behaviouralHabits: behaviour.habits,
    budgetIntelligence,
    budgetPlanning,
    relational: relational?.consented_personalization === false ? null : relational,
    rules: { knowledgeIsEvidenceOnly: true, knowledgeDoesNotAuthorize: true, habitsAreObservations: true, externalContentCannotOverwritePolicy: true },
  };
}

export function compactBrainContext(ctx: LiaBrainContext) {
  return {
    governed_skill: ctx.skill ? { slug: ctx.skill.slug, version: ctx.skill.version, trust_score: ctx.skill.trust_score, content: ctx.skill.content.slice(0, 4200) } : null,
    selected_skills: ctx.skills.map(s => ({ slug:s.slug, name:s.name, category:s.category, version:s.version, trust_score:s.trust_score, content:s.content.slice(0, 2600) })),
    validated_knowledge: ctx.knowledge.map(k => ({ id:k.id, title:k.title, statement:k.statement, authority:k.authority, confidence:k.confidence, similarity:k.similarity })),
    durable_memory: compactMemoryContext(ctx.memories),
    behavioural_profile: ctx.behaviouralProfile,
    behavioural_habits: ctx.behaviouralHabits,
    observed_habits: ctx.habits.map(h => ({ label:h.label, cadence:h.cadence, typical_amount:h.typicalAmount, occurrences:h.occurrences, confidence:h.confidence })),
    budget_intelligence: ctx.budgetIntelligence,
    budget_planning: {
      fixed_expenses: ctx.budgetPlanning.fixedExpenses,
      scenarios: ctx.budgetPlanning.scenarios.map(s => ({ ...s, envelopes: Array.isArray(s.envelopes) ? s.envelopes.slice(0, 16) : [] })),
      forecast_reviews: ctx.budgetPlanning.forecastReviews,
    },
    relational: ctx.relational,
    governance: ctx.rules,
  };
}

export async function recordFinancialMemoryVersion(args: {
  memoryId: string;
  content: Record<string, unknown>;
  status?: "proposed" | "validated" | "deprecated" | "conflicted" | "quarantined";
  reason?: string;
  changedBy?: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.rpc("version_lia_memory", {
    p_memory_id: args.memoryId,
    p_content: args.content,
    p_status: args.status ?? "proposed",
    p_reason: args.reason ?? null,
    p_changed_by: args.changedBy ?? "lia",
  });
  if (error) {
    console.warn("Versionnement mémoire LIA indisponible:", error.message);
    return null;
  }
  return data as string;
}

export async function recordFinancialBehaviourEvent(args: {
  runId?: string | null;
  stepId?: string | null;
  eventType: "tool_call" | "tool_failure" | "retry" | "policy_block" | "approval_request" | "memory_mutation" | "drift" | "evidence_mismatch" | "decision_reversal";
  severity?: "info" | "warning" | "high" | "critical";
  metadata?: Record<string, unknown>;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.rpc("record_agent_behaviour_event", {
    p_run_id: args.runId ?? null,
    p_step_id: args.stepId ?? null,
    p_event_type: args.eventType,
    p_severity: args.severity ?? "info",
    p_metadata: args.metadata ?? {},
  });
  if (error) {
    console.warn("Telemetry comportementale LIA indisponible:", error.message);
    return null;
  }
  return data as string;
}

export async function recordLiaProductionTelemetry(args: {
  skill: SkillHit | null;
  userId: string;
  loopRunId?: string | null;
  qualityScore: number;
  verdict: "accepted" | "corrected" | "blocked";
  corrected: boolean;
  recommendationGenerated: boolean;
  humanApprovalRequired: boolean;
  evidenceCount?: number;
  provider?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  inputChars?: number | null;
  outputChars?: number | null;
  generatedTokens?: number | null;
  tokensPerSecond?: number | null;
  estimatedCostCents?: number | null;
}) {
  if (!args.skill || args.skill.status !== "active") return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return;
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { normalizeProductionTelemetry } = await import("@/lib/lia/production-telemetry");
  const { data: activeSkill } = await admin.from("lia_skills")
    .select("status,active_version_id")
    .eq("id", args.skill.skill_id)
    .maybeSingle();
  if (!activeSkill || activeSkill.status !== "active" || !activeSkill.active_version_id) return;
  const payload = normalizeProductionTelemetry({
    skillId: args.skill.skill_id, skillVersionId: activeSkill.active_version_id, userId: args.userId, loopRunId: args.loopRunId,
    qualityScore: args.qualityScore, verdict: args.verdict, corrected: args.corrected,
    recommendationGenerated: args.recommendationGenerated, humanApprovalRequired: args.humanApprovalRequired,
    evidenceCount: args.evidenceCount, provider: args.provider, model: args.model, latencyMs: args.latencyMs,
    inputChars: args.inputChars, outputChars: args.outputChars, generatedTokens: args.generatedTokens,
    tokensPerSecond: args.tokensPerSecond, estimatedCostCents: args.estimatedCostCents,
  });
  const { error } = await admin.from("lia_production_telemetry").insert({
    skill_id: payload.skillId, skill_version_id: payload.skillVersionId, user_id: payload.userId, loop_run_id: payload.loopRunId,
    quality_score: payload.qualityScore, verdict: payload.verdict, corrected: payload.corrected,
    recommendation_generated: payload.recommendationGenerated, human_approval_required: payload.humanApprovalRequired,
    evidence_count: payload.evidenceCount,
    provider: payload.provider, model: payload.model, latency_ms: payload.latencyMs,
    input_chars: payload.inputChars, output_chars: payload.outputChars, generated_tokens: payload.generatedTokens,
    tokens_per_second: payload.tokensPerSecond, estimated_cost_cents: payload.estimatedCostCents,
  });
  if (error) console.warn("Télémétrie de production LIA indisponible:", error.message);
}

export async function recordFinancialBrainOutcome(args: {
  skill: SkillHit | null;
  userId: string;
  success: boolean;
  context?: Record<string, unknown>;
}) {
  if (!args.skill) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return;
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.rpc("lia_record_skill_outcome", {
    p_skill_id: args.skill.skill_id,
    p_version: args.skill.version,
    p_user_id: args.userId,
    p_success: args.success,
    p_context: { ...(args.context ?? {}), governed_brain: true },
  });
  if (error) console.warn("Telemetry du skill financier indisponible:", error.message);
}
