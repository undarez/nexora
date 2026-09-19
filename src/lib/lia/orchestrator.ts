import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLiaProcedures, selectProcedure, type LiaProcedure } from "@/lib/lia/procedure-engine";
import { loadStrategyExperiences } from "@/lib/lia/strategy-learning";
import { buildStrategyContextKey, type StrategyContext } from "@/lib/lia/contextual-strategy-memory";
import { loadConsolidatedStrategyMemory } from "@/lib/lia/strategy-consolidation";
import { selectStrategyV2 } from "@/lib/lia/strategy-selection";
import { searchLiaUseCases, buildUseCaseCandidate, type UseCaseHit } from "@/lib/lia/use-cases/registry";
import { searchLiaSkills, type SkillHit } from "@/lib/lia/skills/registry";

export type LiaOrchestrationStepPlan = {
  index: number;
  procedure: LiaProcedure;
  riskClass: LiaProcedure["risk_class"];
  humanGateRequired: boolean;
  status: "planned" | "awaiting_human" | "blocked";
  objective: string;
  verificationRules: string[];
};

export type LiaOrchestrationPlan = {
  objective: string;
  maxSteps: number;
  status: "planned" | "awaiting_human" | "blocked";
  reason: string;
  steps: LiaOrchestrationStepPlan[];
  strategyKey: string;
  strategyContextKey: string;
  useCase: UseCaseHit | null;
  candidateUseCase: ReturnType<typeof buildUseCaseCandidate> | null;
  skills: SkillHit[];
  governance: { riskClass: LiaProcedure["risk_class"]; minimumAutonomy: number; humanApprovalRequired: boolean };
};

function riskRank(v: string) {
  return v === "critical" ? 3 : v === "write-sensitive" ? 2 : v === "recommendation" ? 1 : 0;
}

export function agentKeyForProcedure(slug: string) {
  if (slug === "research_and_verify") return "lia:research";
  if (slug === "financial_snapshot_review" || slug === "budget_health_check") return "lia:finance-observer";
  if (slug === "relational_adaptation") return "lia:relationship";
  if (slug === "human_gate_sensitive_action") return "lia:human-gate";
  return "lia:orchestrator";
}

function classifyObjective(objective: string) {
  const s = objective.toLowerCase();
  return {
    research: /(cherche|recherche|source|actualité|réglement|veille|internet|vérif)/i.test(s),
    budget: /(budget|dépense|enveloppe|épargne)/i.test(s),
    finance: /(solde|compte|transaction|trésorerie|cashflow|finance|patrimoine)/i.test(s),
    relational: /(préférence|personnalise|ton|style|habitude)/i.test(s),
    action: /(crée|créé|ajoute|modifie|supprime|exécute|envoie|propose)/i.test(s),
  };
}

export async function buildLiaOrchestrationPlan(args: {
  supabase: SupabaseClient;
  userId: string;
  objective: string;
  maxSteps?: number;
  consentedPersonalization?: boolean;
  excludeProcedureSlugs?: string[];
}) : Promise<LiaOrchestrationPlan> {
  const maxSteps = Math.max(1, Math.min(5, Math.floor(args.maxSteps ?? 5)));
  const objective = args.objective.trim().slice(0, 2000);
  const excludedProcedures = new Set((args.excludeProcedureSlugs ?? []).filter(Boolean));
  const c = classifyObjective(objective);
  const useCases = await searchLiaUseCases(args.supabase, args.userId, objective, undefined, 8);
  const useCase = useCases[0] ?? null;
  const candidateUseCase = useCase ? null : buildUseCaseCandidate({
    name: `Procédure candidate · ${objective.slice(0, 90)}`,
    description: "Scénario généré par LIA à partir de l'objectif fourni. Il reste candidat jusqu'à validation.",
    objective,
    trigger: "Objectif utilisateur explicite",
    requiredContext: ["contexte financier autorisé", "preuves disponibles"],
    requiredSkills: ["financial-agent-intelligence"],
    suggestedTools: [],
    riskClass: "recommendation",
    minimumAutonomy: 0,
    humanApprovalRequired: true,
    successCriteria: ["Réponse vérifiable", "Aucune écriture financière non autorisée"],
    verificationRules: ["Vérifier les données disponibles", "Tracer les hypothèses", "Passer par le Policy Gate avant toute action"],
  });
  let skills: SkillHit[] = [];
  if (useCase) {
    skills = await searchLiaSkills(args.supabase, args.userId, "", undefined, 20);
    const required = new Set(useCase.required_skills);
    skills = skills.filter(skill => required.has(skill.slug) || required.has(skill.name));
    // Financial Agent Intelligence is a governed baseline skill: it enriches every
    // Use Case without granting permissions or replacing the Use Case's own skills.
    const intelligence = (await searchLiaSkills(args.supabase, args.userId, "financial agent intelligence", "intelligence", 2))
      .find(skill => skill.slug === "financial-agent-intelligence");
    if (intelligence && !skills.some(skill => skill.slug === intelligence.slug)) skills.unshift(intelligence);
  }
  const { data: autonomy } = await args.supabase.rpc("get_lia_autonomy", { p_user_id: args.userId });
  const autonomyLevel = Number(autonomy ?? 0);
  const { data: profile } = await args.supabase.from("lia_autonomy_profiles").select("max_autonomy_level").eq("user_id", args.userId).maybeSingle();
  const maxAutonomy = Number(profile?.max_autonomy_level ?? autonomyLevel);
  const { data: relational } = await args.supabase.from("lia_user_relationship_profiles").select("consented_personalization").eq("user_id", args.userId).maybeSingle();
  const consented = args.consentedPersonalization ?? relational?.consented_personalization === true;
  const procedures = await loadLiaProcedures(args.supabase, undefined, 10);
  const candidates = procedures.map(p => ({
    p,
    sel: selectProcedure(p, {
      autonomyLevel,
      consentedPersonalization: consented,
      externalInformation: c.research,
      financialContext: c.finance,
      budgetContext: c.budget,
    })
  }));

  const strategies: Array<{key:string; order:string[]}> = [];
  if (c.research) strategies.push({ key:"research-first", order:["research_and_verify","financial_snapshot_review","budget_health_check","relational_adaptation","human_gate_sensitive_action"] });
  if (c.budget) strategies.push({ key:"budget-first", order:["budget_health_check","financial_snapshot_review","research_and_verify","relational_adaptation","human_gate_sensitive_action"] });
  if (c.finance && !c.budget && !c.research) strategies.push({ key:"finance-first", order:["financial_snapshot_review","research_and_verify","relational_adaptation","human_gate_sensitive_action"] });
  if (c.relational && consented) strategies.push({ key:"relational-first", order:["relational_adaptation","financial_snapshot_review","budget_health_check","research_and_verify","human_gate_sensitive_action"] });
  if (c.action) strategies.push({ key:"human-gated-action", order:["financial_snapshot_review","budget_health_check","research_and_verify","human_gate_sensitive_action"] });
  if (!strategies.length) strategies.push({ key:"observation-first", order:["financial_snapshot_review","budget_health_check","research_and_verify","relational_adaptation"] });
  const strategyContext: StrategyContext = {
    objectiveType: c.action ? "action" : c.research ? "research" : c.budget ? "budget" : c.finance ? "finance" : c.relational ? "relational" : "general",
    ...c,
    relational: consented && c.relational,
    autonomyLevel,
    maxAutonomyLevel: maxAutonomy,
  };
  const experiences = await loadStrategyExperiences({ supabase: args.supabase, userId: args.userId, goalKey: objective.slice(0,160), limit: 100 });
  const strategyContextKey = buildStrategyContextKey(strategyContext);
  const memories = await loadConsolidatedStrategyMemory({ supabase: args.supabase, userId: args.userId, goalKey: objective.slice(0,160), limit: 20 });
  const selection = selectStrategyV2({
    allowed: strategies.map(s => s.key),
    experiences,
    memories,
    context: strategyContext,
    contextKey: strategyContextKey,
    explorationRate: 0.10,
  });
  const strategyKey = selection.selected;
  const selectedStrategy = strategies.find(s=>s.key===strategyKey) ?? strategies[0];
  const ordered: LiaProcedure[] = [];
  const add = (slug: string) => {
    if (excludedProcedures.has(slug)) return;
    const p = candidates.find(x => x.p.slug === slug)?.p;
    if (p && !ordered.some(x => x.slug === p.slug)) ordered.push(p);
  };
  for (const slug of selectedStrategy.order) {
    if (slug === "relational_adaptation" && !(c.relational && consented)) continue;
    if (slug === "research_and_verify" && !c.research) continue;
    if (slug === "budget_health_check" && !c.budget) continue;
    if (slug === "financial_snapshot_review" && !(c.finance || c.budget || !c.research)) continue;
    if (slug === "human_gate_sensitive_action" && !c.action) continue;
    add(slug);
  }
  if (!ordered.length) {
    add("financial_snapshot_review");
    add("budget_health_check");
    if (!ordered.length) add("research_and_verify");
    if (!ordered.length) add("relational_adaptation");
  }
  const steps = ordered.slice(0, maxSteps).map((p, i) => {
    const sel = candidates.find(x => x.p.id === p.id)!.sel;
    const human = p.human_approval_required || riskRank(p.risk_class) >= 2;
    const blocked = sel.blocked || autonomyLevel < p.minimum_autonomy || autonomyLevel > maxAutonomy;
    return {
      index: i + 1,
      procedure: p,
      riskClass: p.risk_class,
      humanGateRequired: human,
      status: blocked ? "blocked" : human ? "awaiting_human" : "planned",
      objective,
      verificationRules: p.verification_rules ?? [],
    } as LiaOrchestrationStepPlan;
  });
  const blocked = steps.some(s => s.status === "blocked");
  const awaiting = !blocked && steps.some(s => s.status === "awaiting_human");
  return {
    objective,
    maxSteps,
    status: blocked ? "blocked" : awaiting ? "awaiting_human" : "planned",
    strategyKey,
    strategyContextKey,
    useCase,
    candidateUseCase,
    skills,
    governance: {
      riskClass: steps.reduce((highest, step) => riskRank(step.riskClass) > riskRank(highest) ? step.riskClass : highest, "read" as LiaProcedure["risk_class"]),
      minimumAutonomy: steps.reduce((highest, step) => Math.max(highest, step.procedure.minimum_autonomy), 0),
      humanApprovalRequired: steps.some(step => step.humanGateRequired),
    },
    reason: blocked ? "Une ou plusieurs étapes dépassent les limites d'autonomie." :
      awaiting ? "Le plan contient une étape nécessitant une validation humaine." :
      "Plan borné par des procédures gouvernées et vérifiables.",
    steps,
  };
}

export async function persistLiaOrchestrationPlan(args: {
  supabase: SupabaseClient; userId: string; plan: LiaOrchestrationPlan;
}) {
  const { data: run, error } = await args.supabase.from("lia_orchestration_runs").insert({
    user_id: args.userId,
    objective: args.plan.objective,
    status: args.plan.status,
    max_steps: args.plan.maxSteps,
    current_step: 0,
    context: { bounded: true, planning_only: true, strategy_key: args.plan.strategyKey, strategy_context_key: args.plan.strategyContextKey },
    strategy_key: args.plan.strategyKey,
    result: { reason: args.plan.reason },
  }).select("id,objective,status,max_steps,current_step,created_at").single();
  if (error || !run) throw new Error(error?.message ?? "Impossible de créer l'orchestration.");

  if (args.plan.steps.length) {
    const { error: stepError } = await args.supabase.from("lia_orchestration_steps").insert(
      args.plan.steps.map(s => ({
        run_id: run.id,
        step_index: s.index,
        procedure_id: s.procedure.id,
        procedure_slug: s.procedure.slug,
        objective: s.objective,
        status: s.status,
        risk_class: s.riskClass,
        human_gate_required: s.humanGateRequired,
        verification_rules: s.verificationRules,
        input_context: {},
        output_context: {},
        parent_step_id: s.index > 1 ? null : null,
        depends_on: s.index > 1 ? [s.index - 1] : [],
        agent_key: agentKeyForProcedure(s.procedure.slug),
        execution_policy: {
          read_only: !s.humanGateRequired,
          human_gate_required: s.humanGateRequired,
          risk_class: s.riskClass,
          max_retries: 2,
          permission_grant: false,
        },
      }))
    );
    if (stepError) throw new Error(stepError.message);
  }
  return { run, steps: args.plan.steps.map(s => ({
    index: s.index, procedure: s.procedure.slug, status: s.status,
    human_gate_required: s.humanGateRequired, risk_class: s.riskClass,
    verification_rules: s.verificationRules
  })) };
}
