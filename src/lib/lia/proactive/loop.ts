import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { liaChat } from "@/lib/lia/provider";
import { detectFinancialSignals, type WatchTransaction, type FinancialSignal } from "@/lib/finance/financial-watch";
import { detectGoalSignals } from "@/lib/finance/goal-watch";
import { searchLiaUseCases } from "@/lib/lia/use-cases/registry";
import { searchLiaSkills } from "@/lib/lia/skills/registry";
import { getLiaPrincipal } from "@/lib/security/agent-identity";
import { clampAutonomy } from "@/lib/security/autonomy";
import { startAgentLoop, recordAgentLoopStep, recordEvidence, finishAgentLoop } from "@/lib/agents/loop-engine";
import { prioritizeSignals } from "@/lib/lia/prioritization";
import { chooseEffort, deterministicFallback, validateLiaAnalysis } from "@/lib/lia/effort-budget";
import { buildLiaBrainContext, compactBrainContext, learnFinancialHabits, recordFinancialBrainOutcome } from "@/lib/lia/financial-memory/pipeline";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Runtime serveur incomplet : Policy Engine indisponible.");
  return createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function loadSignals(supabase: SupabaseClient, userId: string): Promise<FinancialSignal[]> {
  const [tx, accounts, scenario, goals] = await Promise.all([
    supabase.from("transactions").select("id,label,amount,occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(500),
    supabase.from("accounts").select("balance").eq("user_id", userId).limit(50),
    supabase.from("budget_scenarios").select("safety_reserve").eq("user_id", userId).order("period_start", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("goals").select("id,name,target_amount,current_amount,target_date,priority").eq("user_id", userId).order("priority").limit(50),
  ]);
  if (tx.error || accounts.error || scenario.error || goals.error) throw new Error("Contexte financier indisponible.");
  const balance = (accounts.data ?? []).reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
  const reserve = Number(scenario.data?.safety_reserve ?? 0);
  const base = detectFinancialSignals((tx.data ?? []).map(row => ({ ...row, amount: Number(row.amount) })) as WatchTransaction[], balance, reserve);
  const goalSignals = detectGoalSignals((goals.data ?? []).map(row => ({ ...row, target_amount:Number(row.target_amount), current_amount:Number(row.current_amount) })));
  return [...base, ...goalSignals].slice(0, 8);
}

export async function runProactiveFinancialLoop(supabase: SupabaseClient, userId: string, signalId?: string, options: { serverMode?: boolean } = {}) {
  const signals = await loadSignals(supabase, userId);
  const prioritized = prioritizeSignals(signals);
  const signal = (signalId ? signals.find(item => item.id === signalId) : prioritized[0]) ?? null;
  if (!signal) return { status: "no_signal" as const, signal_count: signals.length };

  const admin = adminClient();
  const { data: existingProposal, error: existingError } = await admin.from("lia_action_proposals")
    .select("id,status,created_at")
    .eq("user_id", userId)
    .contains("payload", { signal_id: signal.id })
    .in("status", ["proposed", "approved", "executed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error("Impossible de vérifier les propositions proactives existantes.");
  if (existingProposal) return { status: "already_handled" as const, signal, proposal_id: existingProposal.id, proposal_status: existingProposal.status };

  const effort = chooseEffort({ severity: signal.severity, remainingDays: Number(signal.evidence?.remainingDays), userRequested: Boolean(signalId) });
  const goal = `Analyser et traiter le signal financier : ${signal.title} — ${signal.message}`;
  const loopId = await startAgentLoop(supabase, userId, goal, "proactive", { signal_id: signal.id, signal });
  try {
    await learnFinancialHabits({ supabase, userId, transactions: (await supabase.from("transactions").select("id,label,amount,occurred_at").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(500)).data ?? [] });
  } catch (error) {
    console.warn("Habitudes proactives indisponibles:", error instanceof Error ? error.message : error);
  }
  let brainContext: Awaited<ReturnType<typeof buildLiaBrainContext>> | null = null;
  try {
    brainContext = await buildLiaBrainContext({ supabase, userId, query: `${signal.title} ${signal.message}`, loopRunId: loopId });
    await recordAgentLoopStep(supabase, loopId, 15, { phase: "context", agentKey: "lia:financial-brain", input: { signal_id: signal.id }, output: { governed_skill: brainContext.skill?.slug ?? null, knowledge_count: brainContext.knowledge.length, memory_count: brainContext.memories.length, habit_count: brainContext.habits.length }, status: "completed" });
  } catch (error) {
    console.warn("Cerveau financier proactif indisponible:", error instanceof Error ? error.message : error);
  }
  let order = 1;
  try {
    await recordAgentLoopStep(supabase, loopId, order++, { phase: "observe", agentKey: "lia", input: { signal_id: signal.id }, output: { signal, priority: prioritized.find(item => item.id === signal.id)?.priorityScore ?? null }, status: "completed" });
    await recordEvidence(supabase, loopId, "financial_watch", "signal", signal as unknown as Record<string, unknown>);

    const [useCases, skills] = await Promise.all([
      searchLiaUseCases(supabase, userId, `${signal.title} ${signal.message}`, undefined, 5),
      searchLiaSkills(supabase, userId, `${signal.title} ${signal.message}`, undefined, 8),
    ]);
    const useCase = useCases.find(item => signal.id.startsWith("goal:") && item.slug === "goal-tracking") ?? useCases.find(item => item.slug === "spending-drift") ?? useCases[0] ?? null;
    const baseline = brainContext?.skill ? [brainContext.skill] : [];
    const selectedSkills = [...baseline, ...(useCase ? skills.filter(skill => useCase.required_skills.includes(skill.slug) || useCase.required_skills.includes(skill.name)) : skills)].filter((skill, index, arr) => arr.findIndex(x => x.slug === skill.slug) === index).slice(0, 6);
    await recordAgentLoopStep(supabase, loopId, order++, { phase: "plan", agentKey: "lia", input: { use_case: useCase?.slug ?? null }, output: { use_case: useCase, skills: selectedSkills.map(skill => skill.slug) }, status: "completed" });

    let synthesis: { content: string; model: string; provider: "local_native" | "ollama" | "remote" | "deterministic" };
    try {
      synthesis = await liaChat([
      { role: "system", content: "Tu es LIA, superviseur financier de Gérer Finance. Tu analyses uniquement les preuves fournies. Tu ne dois jamais inventer une donnée, exécuter une opération financière ou transformer une hypothèse en fait." },
      { role: "user", content: [
        `Signal vérifié : ${JSON.stringify(signal)}`,
        `Use Case : ${JSON.stringify(useCase)}`,
        `Skills disponibles : ${JSON.stringify(selectedSkills.map(skill => ({ slug: skill.slug, name: skill.name, content: skill.content.slice(0, 2500) })))} `,
        `Cerveau financier gouverné : ${JSON.stringify(brainContext ? compactBrainContext(brainContext) : null)}`,
        "Produis une analyse courte avec : faits, cause possible explicitement qualifiée, risque, recommandation non destructive, vérification suivante.",
      ].join("\n\n") },
      ], AbortSignal.timeout(effort.timeoutMs));
      const checked = validateLiaAnalysis(synthesis.content, effort.maxResponseChars);
      if (!checked.valid && effort.stopOnLowConfidence) throw new Error("Analyse LIA insuffisamment vérifiable.");
    } catch (analysisError) {
      const fallback = deterministicFallback(signal);
      synthesis = { content: fallback, model: "deterministic-fallback", provider: "deterministic" };
      await recordAgentLoopStep(supabase, loopId, order++, { phase: "verify", agentKey: "lia", input: { reason: analysisError instanceof Error ? analysisError.message : "analysis_error", effort }, output: { fallback: true }, status: "completed" });
    }
    await recordAgentLoopStep(supabase, loopId, order++, { phase: "decide", agentKey: "lia", input: { signal_id: signal.id }, output: { model: synthesis.model, provider: synthesis.provider, effort }, status: "completed" });

    const principal = getLiaPrincipal(userId);
    const { error: identityError } = await admin.from("lia_agent_identities").upsert({ agent_id: principal.agentId, user_id: userId, agent_key: "lia", role: "financial_assistant", organization_id: principal.organizationId, enabled: true }, { onConflict: "agent_id" });
    if (identityError) throw new Error("Identité LIA indisponible.");
    const { data: autonomy, error: autonomyError } = await supabase.rpc("get_lia_autonomy", { p_user_id: userId });
    if (autonomyError) throw new Error("Autonomie LIA indisponible.");
    const autonomyLevel = clampAutonomy(autonomy, 1);
    const { data: policy, error: policyError } = await admin.rpc("authorize_lia_tool", { p_agent_id: principal.agentId, p_user_id: userId, p_organization_id: principal.organizationId, p_tool_key: "create_recommendation", p_autonomy_level: autonomyLevel });
    if (policyError) throw new Error("Policy Engine indisponible.");
    if (!policy?.allowed && policy?.reason !== "human_approval_required") {
      await finishAgentLoop(supabase, loopId, "blocked", { reason: policy?.reason ?? "policy_denied", signal_id: signal.id });
      return { status: "blocked" as const, loop_id: loopId, signal, use_case: useCase, analysis: synthesis.content };
    }

    const title = `LIA · ${signal.title}`.slice(0, 200);
    const description = synthesis.content.slice(0, 10000);
    const executionKey = `proactive:${signal.id}:${useCase?.slug ?? "none"}`;
    const { data: proposal, error: proposalError } = await admin.from("lia_action_proposals").upsert({
      user_id: userId, agent_id: principal.agentId, action_key: "create_recommendation", title,
      description, risk_class: "recommendation", autonomy_level: autonomyLevel, reversible: true,
      payload: { title, body: description, source: "financial_watch", signal_id: signal.id, use_case_id: useCase?.use_case_id ?? null, loop_run_id: loopId },
      rollback_payload: { action: "delete_recommendation_by_proposal" }, status: "proposed",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), execution_key: executionKey,
    }, { onConflict: "user_id,execution_key" }).select("id,status,created_at").single();
    if (proposalError) throw new Error(`Impossible de créer la proposition : ${proposalError.message}`);

    const notification = { id: `lia-proposal:${proposal.id}`, severity: signal.severity, title: "LIA a préparé une proposition", message: "Une analyse proactive est prête dans Pilotage pour validation.", actionHref: "/pilotage" };
    const isAdminClient = options.serverMode === true;
    if (isAdminClient) {
      const { error: notifyError } = await supabase.from("notifications").upsert({ user_id: userId, type: "system", severity: signal.severity, title: notification.title, message: notification.message, action_href: notification.actionHref, dedupe_key: `financial-watch:${notification.id}` }, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
      if (notifyError) throw new Error("Notification proactive indisponible.");
    } else {
      const { error: notifyError } = await supabase.rpc("publish_financial_watch_notifications", { p_user_id: userId, p_signals: [notification] });
      if (notifyError) throw new Error("Notification proactive indisponible.");
    }

    await recordAgentLoopStep(supabase, loopId, order++, { phase: "act", agentKey: "lia", input: { proposal_id: proposal.id }, output: { status: "proposal_created", human_approval_required: true }, status: "completed" });
    await recordEvidence(supabase, loopId, "lia", "analysis", { analysis: synthesis.content, model: synthesis.model });
    try { await recordFinancialBrainOutcome({ skill: brainContext?.skill ?? null, userId, success: synthesis.provider !== "deterministic", context: { loop_run_id: loopId, signal_id: signal.id, knowledge_count: brainContext?.knowledge.length ?? 0, habit_count: brainContext?.habits.length ?? 0 } }); } catch {}
    await finishAgentLoop(supabase, loopId, "needs_human", { signal_id: signal.id, proposal_id: proposal.id, use_case_id: useCase?.use_case_id ?? null, next: "human_validation" });
    return { status: "needs_human" as const, loop_id: loopId, signal, use_case: useCase, skills: selectedSkills, analysis: synthesis.content, proposal_id: proposal.id };
  } catch (error) {
    await finishAgentLoop(supabase, loopId, "failed", { error: error instanceof Error ? error.message : "Erreur proactive." });
    throw error;
  }
}
