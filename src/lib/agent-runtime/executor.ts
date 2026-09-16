import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { buildLiaFinancialProjection } from "@/lib/lia/financial-data-gateway";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getAgentTool } from "./tool-registry";
import { authorizeAgentTool, getLiaPrincipal } from "@/lib/security/agent-identity";
import { clampAutonomy, type AutonomyLevel } from "@/lib/security/autonomy";
import { searchLiaSkills } from "@/lib/lia/skills/registry";
import { recordDecisionGate } from "@/lib/lia/financial-memory/governance";
import { recordFinancialBehaviourEvent } from "@/lib/lia/financial-memory/pipeline";
import { searchLiaUseCases, buildUseCaseCandidate } from "@/lib/lia/use-cases/registry";
import { runLiveResearch } from "@/lib/lia/research/live";
import { getLiaRuntimeControls } from "@/lib/lia/runtime/controls";

export type ToolCall = { name: string; arguments?: Record<string, unknown> };

export async function executeAgentTool(
  supabase: SupabaseClient,
  userId: string,
  call: ToolCall,
  governanceContext?: { runId?: string | null; stepId?: string | null; knowledgeIds?: string[]; evidenceIds?: string[] },
) {
  const principal = getLiaPrincipal(userId);
  const { data: autonomyData, error: autonomyError } = await supabase.rpc("get_lia_autonomy", { p_user_id: userId });
  if (autonomyError) throw new Error(`Autonomie LIA indisponible : ${autonomyError.message}`);
  const autonomyLevel = clampAutonomy(autonomyData, 1);
  const localAuthorization = authorizeAgentTool(principal, call.name, autonomyLevel);
  if (!localAuthorization.allowed && localAuthorization.reason !== "human_approval_required") throw new Error(`Policy agent refusée : ${localAuthorization.reason}`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Policy Engine Supabase indisponible : configuration serveur manquante.");
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: identityError } = await admin.from("lia_agent_identities").upsert({ agent_id: principal.agentId, user_id: userId, agent_key: principal.agentKey, role: principal.role, organization_id: principal.organizationId, enabled: true }, { onConflict: "agent_id" });
  if (identityError) throw new Error(`Identité agent indisponible : ${identityError.message}`);
  const { data: dbDecision, error: dbPolicyError } = await admin.rpc("authorize_lia_tool", { p_agent_id: principal.agentId, p_user_id: userId, p_organization_id: principal.organizationId, p_tool_key: call.name, p_autonomy_level: autonomyLevel });
  if (dbPolicyError) throw new Error(`Policy Engine indisponible : ${dbPolicyError.message}`);
  const policyReason = dbDecision?.reason ?? "policy_denied";
  if (!dbDecision?.allowed) await recordFinancialBehaviourEvent({ runId: governanceContext?.runId, stepId: governanceContext?.stepId, eventType: policyReason === "human_approval_required" ? "approval_request" : "policy_block", severity: policyReason === "human_approval_required" ? "warning" : "high", metadata: { tool: call.name, reason: policyReason } });
  if (!dbDecision?.allowed && policyReason !== "human_approval_required") throw new Error(`Policy agent refusée par Supabase : ${policyReason}`);
  const definition = getAgentTool(call.name);
  if (!definition) throw new Error(`Outil agentique inconnu : ${call.name}`);
  const riskLevel = definition.risk === "write-sensitive" ? "high" : definition.risk === "recommendation" ? "medium" : "low";
  const gate = await recordDecisionGate({ runId: governanceContext?.runId, stepId: governanceContext?.stepId, actionType: call.name, riskLevel, reversible: definition.risk !== "write-sensitive", authorizationPresent: Boolean(dbDecision?.allowed || policyReason === "human_approval_required"), policyId: dbDecision?.policy_id ?? dbDecision?.policyId ?? null, knowledgeIds: governanceContext?.knowledgeIds, evidenceIds: governanceContext?.evidenceIds, rationale: { policy_reason: policyReason, local_authorization: localAuthorization.allowed, knowledge_is_not_authorization: true } });
  if (gate?.outcome === "BLOCK") throw new Error(`Decision Gate : action bloquée (${call.name}).`);
  if (gate?.outcome === "REQUIRE_APPROVAL" && policyReason !== "human_approval_required") throw new Error(`Decision Gate : validation humaine requise (${call.name}).`);
  if (definition.risk === "write-sensitive") throw new Error(`Outil sensible bloqué sans validation humaine : ${call.name}`);
  const args = call.arguments ?? {};
  switch (call.name) {
    case "research_web": {
      const controls = await getLiaRuntimeControls(supabase);
      if (!controls.ai_enabled || !controls.web_research_enabled) throw new Error("Recherche web LIA désactivée par le kill switch ou la politique d'administration.");
      const query = typeof args.query === "string" ? args.query.trim().slice(0, 2000) : "";
      if (!query) throw new Error("Une requête de recherche web est obligatoire.");
      const maxSources = Math.min(Math.max(Number(args.max_sources ?? 4), 1), 6);
      const timeoutMs = Math.min(Math.max(Number(args.timeout_ms ?? 8000), 2000), 12000);
      const result = await runLiveResearch({ query, maxSources, timeoutMs, discover: args.discover !== false });
      await admin.from("lia_research_runs").insert({ user_id: userId, query, evidence: result.evidence ?? [], claims: result.claims ?? [], contradictions: result.contradictions ?? [], stale_evidence: result.staleEvidence ?? [], unknowns: result.unknowns ?? [], minimum_evidence_met: Boolean(result.minimumEvidenceMet), knowledge_graph_ready: Boolean(result.minimumEvidenceMet), activation_allowed: false });
      return { ...result, query, live: true, read_only: true, activation_allowed: false };
    }
    case "search_use_cases": { const query = typeof args.query === "string" ? args.query : ""; return { use_cases: await searchLiaUseCases(admin, userId, query, typeof args.category === "string" ? args.category : undefined, Number(args.limit ?? 8)) }; }
    case "learn_use_case": {
      if (autonomyLevel < 1) throw new Error("La création d’un Use Case candidat nécessite L1.");
      const candidate = buildUseCaseCandidate({ name: typeof args.name === "string" ? args.name : "Use Case appris", description: typeof args.description === "string" ? args.description : "Scénario réutilisable proposé par LIA.", objective: typeof args.objective === "string" ? args.objective : "Objectif à préciser.", trigger: typeof args.trigger === "string" ? args.trigger : "Demande utilisateur ou nouvelle capacité.", requiredContext: Array.isArray(args.required_context) ? args.required_context.filter((x): x is string => typeof x === "string").slice(0, 20) : [], requiredSkills: Array.isArray(args.required_skills) ? args.required_skills.filter((x): x is string => typeof x === "string").slice(0, 20) : [], suggestedTools: Array.isArray(args.suggested_tools) ? args.suggested_tools.filter((x): x is string => typeof x === "string").slice(0, 20) : [], riskClass: (typeof args.risk_class === "string" && ["read","recommendation","write-sensitive","critical"].includes(args.risk_class) ? args.risk_class : "read") as "read" | "recommendation" | "write-sensitive" | "critical", minimumAutonomy: Number(args.minimum_autonomy ?? 0), humanApprovalRequired: Boolean(args.human_approval_required), successCriteria: Array.isArray(args.success_criteria) ? args.success_criteria.filter((x): x is string => typeof x === "string").slice(0, 20) : [], verificationRules: Array.isArray(args.verification_rules) ? args.verification_rules.filter((x): x is string => typeof x === "string").slice(0, 20) : [] });
      if (candidate.requiredSkills.length === 0 || candidate.successCriteria.length === 0 || candidate.verificationRules.length === 0) throw new Error("Un Use Case candidat doit préciser skills, critères de réussite et règles de vérification.");
      const slug = candidate.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60) || "use-case-appris";
      const { data, error } = await admin.rpc("lia_create_use_case_candidate", { p_user_id:userId,p_scope:"user",p_slug:slug,p_name:candidate.name,p_description:candidate.description,p_category:typeof args.category === "string" ? args.category.slice(0,60) : "general",p_objective:candidate.objective,p_trigger:candidate.trigger,p_required_context:candidate.requiredContext,p_required_skills:candidate.requiredSkills,p_suggested_tools:candidate.suggestedTools,p_risk_class:candidate.riskClass,p_minimum_autonomy:candidate.minimumAutonomy,p_human_approval_required:candidate.humanApprovalRequired,p_success_criteria:candidate.successCriteria,p_verification_rules:candidate.verificationRules,p_source_type:"agent_generated" });
      if (error) throw new Error(`Impossible de créer le Use Case candidat : ${error.message}`); return { use_case_id:data, status:"candidate", activation:"blocked_until_validation" };
    }
    case "search_skills": { const query = typeof args.query === "string" ? args.query : ""; return { skills: await searchLiaSkills(admin, userId, query, typeof args.category === "string" ? args.category : undefined, Number(args.limit ?? 8)) }; }
    case "learn_skill": {
      if (autonomyLevel < 1) throw new Error("L'apprentissage procédural nécessite L1.");
      const name = typeof args.name === "string" ? args.name.slice(0, 120) : "Skill appris"; const description = typeof args.description === "string" ? args.description.slice(0, 500) : "Procédure réutilisable apprise par LIA."; const procedure = typeof args.procedure === "string" ? args.procedure.slice(0, 12000) : ""; if (procedure.length < 20) throw new Error("La procédure à mémoriser est insuffisante.");
      const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "skill-appris";
      const candidate = await import("@/lib/lia/skills/registry").then(({ buildSkillCandidate }) => buildSkillCandidate({ name, description, procedure, triggerContext: typeof args.trigger_context === "object" && args.trigger_context !== null ? args.trigger_context as Record<string, unknown> : {}, expectedResult: typeof args.expected_result === "string" ? args.expected_result.slice(0, 1000) : undefined, verificationSteps: Array.isArray(args.verification_steps) ? args.verification_steps.filter((x): x is string => typeof x === "string").slice(0, 10) : undefined, failureModes: Array.isArray(args.failure_modes) ? args.failure_modes.filter((x): x is string => typeof x === "string").slice(0, 10) : undefined, sourceRefs: Array.isArray(args.source_refs) ? args.source_refs.filter((x): x is string => typeof x === "string").slice(0, 10) : undefined, correction: typeof args.correction === "string" ? args.correction.slice(0, 5000) : undefined }));
      const { data, error } = await admin.rpc("lia_create_skill_candidate", { p_user_id:userId,p_scope:"user",p_slug:slug,p_name:candidate.name,p_description:candidate.description,p_category:typeof args.category === "string" ? args.category.slice(0,60) : "general",p_source_type:typeof args.correction === "string" && args.correction.trim() ? "corrected" : "agent_generated",p_content:candidate.content,p_trigger_context:candidate.triggerContext,p_expected_result:candidate.expectedResult,p_verification_steps:candidate.verificationSteps,p_failure_modes:candidate.failureModes,p_source_refs:candidate.sourceRefs,p_memory_gate:candidate.memoryGate });
      if (error) throw new Error(`Impossible de mémoriser le skill : ${error.message}`); return { skill_id:data, status:"candidate", activation:"blocked_until_validation", memory_gate:candidate.memoryGate };
    }
    case "get_financial_snapshot": { const projection = await buildLiaFinancialProjection({ supabase, userId, days: 90 }); return { security_level: projection.security_level, account_count: projection.accounts.count, balance_total: projection.accounts.balance_total, transaction_count: projection.transactions.count, income: projection.transactions.income, expenses: projection.transactions.expenses, net: projection.transactions.net, categories: projection.transactions.categories, raw_data_exposed: false, vault_payload_exposed: false }; }
    case "get_budget_status": { const { data, error } = await supabase.from("budgets").select("id,period_start,period_end,target_end_balance,budget_lines(id,category_id,planned_amount,actual_amount)").eq("user_id", userId).order("period_start", { ascending: false }).limit(3); if (error) throw new Error(error.message); return { budgets: data ?? [], data_available: (data ?? []).length > 0 }; }
    case "get_cashflow": { const days = Math.min(Math.max(Number(args.days ?? 90), 1), 365); const since = new Date(Date.now() - days * 86400000).toISOString(); const { data, error } = await supabase.from("transactions").select("amount,occurred_at").eq("user_id", userId).gte("occurred_at", since).order("occurred_at", { ascending: true }).limit(1000); if (error) throw new Error(error.message); const rows = data ?? []; const income = rows.filter(r=>Number(r.amount)>0).reduce((s,r)=>s+Number(r.amount),0); const expenses = rows.filter(r=>Number(r.amount)<0).reduce((s,r)=>s+Math.abs(Number(r.amount)),0); return { days, transaction_count: rows.length, income: Number(income.toFixed(2)), expenses: Number(expenses.toFixed(2)), net: Number((income-expenses).toFixed(2)), data_available: rows.length > 0 }; }
  }
}