import type { SupabaseClient } from "@supabase/supabase-js";
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
import { assessPreAction } from "@/lib/lia/pre-action-monitor";
import { executeFinancialAgentTool, getFinancialAgentTool } from "./financial-tool-adapter";

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
  const definition = getAgentTool(call.name) ?? getFinancialAgentTool(call.name);
  if (!definition) throw new Error(`Outil agentique inconnu : ${call.name}`);
  const preAction = assessPreAction({
    tool: call.name,
    description: definition.description,
    risk: definition.risk,
    requiresUserApproval: definition.requiresUserApproval,
    deterministic: definition.deterministic,
  });
  await recordFinancialBehaviourEvent({
    runId: governanceContext?.runId,
    stepId: governanceContext?.stepId,
    eventType: "tool_call",
    severity: preAction.disposition === "DENY" ? "high" : preAction.disposition === "REQUIRE_APPROVAL" ? "warning" : "info",
    metadata: { tool: call.name, disposition: preAction.disposition, risk: preAction.risk, capability: preAction.capability, reversible: preAction.reversible, reasons: preAction.reasons },
  });
  if (preAction.disposition === "DENY") throw new Error(`Pre-Action Monitor : action refusée (${call.name}).`);
  // REQUIRE_APPROVAL is recorded here; the existing Policy Engine and Decision Gate remain the authority for approval.

  const riskLevel = definition.risk === "write-sensitive" ? "high" : definition.risk === "recommendation" ? "medium" : "low";
  const gate = await recordDecisionGate({ runId: governanceContext?.runId, stepId: governanceContext?.stepId, actionType: call.name, riskLevel, reversible: definition.risk !== "write-sensitive", authorizationPresent: Boolean(dbDecision?.allowed || policyReason === "human_approval_required"), policyId: dbDecision?.policy_id ?? dbDecision?.policyId ?? null, knowledgeIds: governanceContext?.knowledgeIds, evidenceIds: governanceContext?.evidenceIds, rationale: { policy_reason: policyReason, local_authorization: localAuthorization.allowed, knowledge_is_not_authorization: true } });
  if (gate?.outcome === "BLOCK") throw new Error(`Decision Gate : action bloquée (${call.name}).`);
  if (gate?.outcome === "REQUIRE_APPROVAL" && policyReason !== "human_approval_required") throw new Error(`Decision Gate : validation humaine requise (${call.name}).`);
  if (definition.risk === "write-sensitive") throw new Error(`Outil sensible bloqué sans validation humaine : ${call.name}`);
  const args = call.arguments ?? {};
  const financialTool = await executeFinancialAgentTool(supabase, userId, call.name, args, { admin, agentId: principal.agentId, autonomyLevel });
  if (financialTool.handled) return financialTool.result;

  switch (call.name) {
    case "research_web": {
      const controls = await getLiaRuntimeControls(supabase);
      if (!controls.ai_enabled || !controls.web_research_enabled) throw new Error("Recherche web LIA désactivée par le kill switch ou la politique d'administration.");
      const query = typeof args.query === "string" ? args.query.trim().slice(0, 2000) : "";
      if (!query) throw new Error("Une requête de recherche web est obligatoire.");
      const maxSources = Math.min(Math.max(Number(args.max_sources ?? 4), 1), 6);
      const timeoutMs = Math.min(Math.max(Number(args.timeout_ms ?? 8000), 2000), 12000);
      const result = await runLiveResearch({ query, maxSources, timeoutMs, discover: args.discover !== false, autonomous: args.autonomous === true });
      await admin.from("lia_research_runs").insert({ user_id: userId, query, evidence: result.evidence ?? [], claims: result.claims ?? [], contradictions: result.contradictions ?? [], stale_evidence: result.staleEvidence ?? [], unknowns: result.unknowns ?? [], minimum_evidence_met: Boolean(result.minimumEvidenceMet), knowledge_graph_ready: Boolean(result.minimumEvidenceMet), activation_allowed: false });
      return { ...result, query, live: true, read_only: true, activation_allowed: false };
    }
    case "search_use_cases": { const query = typeof args.query === "string" ? args.query : ""; return { use_cases: await searchLiaUseCases(admin, userId, query, typeof args.category === "string" ? args.category : undefined, Number(args.limit ?? 8)) }; }
    case "learn_use_case": {
      if (autonomyLevel < 7) throw new Error("La création autonome d’un Use Case candidat nécessite L7.");
      const candidate = buildUseCaseCandidate({ name: typeof args.name === "string" ? args.name : "Use Case appris", description: typeof args.description === "string" ? args.description : "Scénario réutilisable proposé par LIA.", objective: typeof args.objective === "string" ? args.objective : "Objectif à préciser.", trigger: typeof args.trigger === "string" ? args.trigger : "Demande utilisateur ou nouvelle capacité.", requiredContext: Array.isArray(args.required_context) ? args.required_context.filter((x): x is string => typeof x === "string").slice(0, 20) : [], requiredSkills: Array.isArray(args.required_skills) ? args.required_skills.filter((x): x is string => typeof x === "string").slice(0, 20) : [], suggestedTools: Array.isArray(args.suggested_tools) ? args.suggested_tools.filter((x): x is string => typeof x === "string").slice(0, 20) : [], riskClass: (typeof args.risk_class === "string" && ["read","recommendation","write-sensitive","critical"].includes(args.risk_class) ? args.risk_class : "read") as "read" | "recommendation" | "write-sensitive" | "critical", minimumAutonomy: Number(args.minimum_autonomy ?? 0), humanApprovalRequired: Boolean(args.human_approval_required), successCriteria: Array.isArray(args.success_criteria) ? args.success_criteria.filter((x): x is string => typeof x === "string").slice(0, 20) : [], verificationRules: Array.isArray(args.verification_rules) ? args.verification_rules.filter((x): x is string => typeof x === "string").slice(0, 20) : [] });
      if (candidate.requiredSkills.length === 0 || candidate.successCriteria.length === 0 || candidate.verificationRules.length === 0) throw new Error("Un Use Case candidat doit préciser skills, critères de réussite et règles de vérification.");
      const slug = candidate.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60) || "use-case-appris";
      const { data, error } = await admin.rpc("lia_create_use_case_candidate", { p_user_id:userId,p_scope:"user",p_slug:slug,p_name:candidate.name,p_description:candidate.description,p_category:typeof args.category === "string" ? args.category.slice(0,60) : "general",p_objective:candidate.objective,p_trigger:candidate.trigger,p_required_context:candidate.requiredContext,p_required_skills:candidate.requiredSkills,p_suggested_tools:candidate.suggestedTools,p_risk_class:candidate.riskClass,p_minimum_autonomy:candidate.minimumAutonomy,p_human_approval_required:candidate.humanApprovalRequired,p_success_criteria:candidate.successCriteria,p_verification_rules:candidate.verificationRules,p_source_type:"agent_generated" });
      if (error) throw new Error(`Impossible de créer le Use Case candidat : ${error.message}`); return { use_case_id:data, status:"candidate", activation:"blocked_until_validation" };
    }
    case "search_skills": { const query = typeof args.query === "string" ? args.query : ""; return { skills: await searchLiaSkills(admin, userId, query, typeof args.category === "string" ? args.category : undefined, Number(args.limit ?? 8)) }; }
    case "learn_skill": {
      if (autonomyLevel < 7) throw new Error("L'apprentissage procédural autonome nécessite L7.");
      const name = typeof args.name === "string" ? args.name.slice(0, 120) : "Skill appris"; const description = typeof args.description === "string" ? args.description.slice(0, 500) : "Procédure réutilisable apprise par LIA."; const procedure = typeof args.procedure === "string" ? args.procedure.slice(0, 12000) : ""; if (procedure.length < 20) throw new Error("La procédure à mémoriser est insuffisante.");
      const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "skill-appris";
      const candidate = await import("@/lib/lia/skills/registry").then(({ buildSkillCandidate }) => buildSkillCandidate({ name, description, procedure, triggerContext: typeof args.trigger_context === "object" && args.trigger_context !== null ? args.trigger_context as Record<string, unknown> : {}, expectedResult: typeof args.expected_result === "string" ? args.expected_result.slice(0, 1000) : undefined, verificationSteps: Array.isArray(args.verification_steps) ? args.verification_steps.filter((x): x is string => typeof x === "string").slice(0, 10) : undefined, failureModes: Array.isArray(args.failure_modes) ? args.failure_modes.filter((x): x is string => typeof x === "string").slice(0, 10) : undefined, sourceRefs: Array.isArray(args.source_refs) ? args.source_refs.filter((x): x is string => typeof x === "string").slice(0, 10) : undefined, correction: typeof args.correction === "string" ? args.correction.slice(0, 5000) : undefined }));
      const { data, error } = await admin.rpc("lia_create_skill_candidate", { p_user_id:userId,p_scope:"user",p_slug:slug,p_name:candidate.name,p_description:candidate.description,p_category:typeof args.category === "string" ? args.category.slice(0,60) : "general",p_source_type:typeof args.correction === "string" && args.correction.trim() ? "corrected" : "agent_generated",p_content:candidate.content,p_trigger_context:candidate.triggerContext,p_expected_result:candidate.expectedResult,p_verification_steps:candidate.verificationSteps,p_failure_modes:candidate.failureModes,p_source_refs:candidate.sourceRefs,p_memory_gate:candidate.memoryGate });
      if (error) throw new Error(`Impossible de mémoriser le skill : ${error.message}`); return { skill_id:data, status:"candidate", activation:"blocked_until_validation", memory_gate:candidate.memoryGate };
    }
    case "create_recommendation": { const title = typeof args.title === "string" ? args.title.slice(0,200) : "Recommandation IA"; const body = typeof args.body === "string" ? args.body.slice(0,10000) : ""; if (!body) throw new Error("Une recommandation doit contenir un contenu."); const { data, error } = await admin.from("lia_action_proposals").insert({ user_id:userId, agent_id:principal.agentId, action_key:"create_recommendation", title, description:body, risk_class:"recommendation", autonomy_level:autonomyLevel, reversible:true, payload:{ title, body }, rollback_payload:{ action:"delete_recommendation_by_proposal" }, status:"proposed", expires_at:new Date(Date.now()+15*60*1000).toISOString() }).select("id,created_at,status").single(); if (error) throw new Error(`Impossible de créer la proposition : ${error.message}`); return { proposal_id:data.id, created_at:data.created_at, status:data.status, requires_human_approval:true }; }
    default: throw new Error(`Outil non implémenté : ${call.name}`);
  }
}

