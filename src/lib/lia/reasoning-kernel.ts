/**
 * NEXORA Reasoning Kernel v1
 *
 * Deterministic cognitive layer between the user's request and any language
 * engine. It classifies intent, required evidence, risk and the next cognitive
 * operation. It never authorizes financial writes and never depends on an LLM.
 */
export type ReasoningIntent =
  | "financial_snapshot"
  | "budget_analysis"
  | "cashflow_analysis"
  | "transaction_analysis"
  | "goal_planning"
  | "forecast_analysis"
  | "external_research"
  | "general_financial_question";

export type ReasoningRisk = "low" | "medium" | "high" | "critical";
export type ReasoningNextStep = "answer" | "research" | "clarify" | "verify" | "human_gate";

export type ReasoningKernelInput = {
  question: string;
  hasAccounts: boolean;
  hasTransactions: boolean;
  hasBudgets: boolean;
  hasForecasts: boolean;
  hasGoals: boolean;
  externalResearchRequested?: boolean;
};

export type ReasoningKernelResult = {
  version: 1;
  intent: ReasoningIntent;
  confidence: number;
  risk: ReasoningRisk;
  nextStep: ReasoningNextStep;
  evidenceRequired: string[];
  missingEvidence: string[];
  constraints: string[];
  signals: string[];
};

const has = (q: string, pattern: RegExp) => pattern.test(q);

export function runReasoningKernel(input: ReasoningKernelInput): ReasoningKernelResult {
  const q = input.question.trim().toLowerCase();
  const signals: string[] = [];
  const constraints = [
    "model_is_advisory_only",
    "financial_writes_are_not_authorized_by_reasoning",
    "critical_actions_require_human_validation",
    "knowledge_and_memory_are_not_authorization",
  ];

  const external = input.externalResearchRequested === true || has(q, /\b(aujourd|actuel|actuelle|2026|loi|règlement|reglement|cnil|amf|acpr|taux|inflation|euribor|prix|tarif|officiel|source|internet|web|recherche|vérifie|verifie)\b/);
  let intent: ReasoningIntent = "general_financial_question";
  if (external) intent = "external_research";
  else if (has(q, /\b(budget|enveloppe|charges fixes|reste à vivre|reste a vivre)\b/)) intent = "budget_analysis";
  else if (has(q, /\b(cashflow|trésorerie|tresorerie|liquidité|liquidite|solde|comptes?)\b/)) intent = "cashflow_analysis";
  else if (has(q, /\b(transaction|dépense|depense|revenu|achat|sortie|entrée|entree)\b/)) intent = "transaction_analysis";
  else if (has(q, /\b(objectif|épargne|epargne|économi|economi|projet)\b/)) intent = "goal_planning";
  else if (has(q, /\b(prévision|prevision|projection|avenir|futur|prochain mois|prochains mois)\b/)) intent = "forecast_analysis";
  else if (has(q, /\b(situation|point complet|analyse générale|analyse generale|où j'en suis|ou j'en suis)\b/)) intent = "financial_snapshot";

  if (external) signals.push("external_fact_dependency");
  if (has(q, /\b(virement|transfert|payer|paie|ouvrir|fermer|modifier|supprimer|investir|acheter|vendre)\b/)) signals.push("action_request");
  if (has(q, /\b(urgent|urgence|immédiat|immediat|maintenant)\b/)) signals.push("urgency_signal");

  const evidenceRequired: string[] = [];
  if (["financial_snapshot", "cashflow_analysis"].includes(intent)) evidenceRequired.push("accounts");
  if (["budget_analysis", "transaction_analysis", "financial_snapshot"].includes(intent)) evidenceRequired.push("transactions");
  if (intent === "budget_analysis") evidenceRequired.push("budget");
  if (intent === "forecast_analysis") evidenceRequired.push("forecasts");
  if (intent === "goal_planning") evidenceRequired.push("goals");
  if (intent === "external_research") evidenceRequired.push("trusted_external_sources");

  const missingEvidence = evidenceRequired.filter((key) => {
    if (key === "accounts") return !input.hasAccounts;
    if (key === "transactions") return !input.hasTransactions;
    if (key === "budget") return !input.hasBudgets;
    if (key === "forecasts") return !input.hasForecasts;
    if (key === "goals") return !input.hasGoals;
    return false;
  });

  const actionRequested = signals.includes("action_request");
  const risk: ReasoningRisk = actionRequested && has(q, /\b(virement|transfert|investir|acheter|vendre)\b/)
    ? "critical"
    : actionRequested ? "high"
      : external ? "medium" : "low";

  let nextStep: ReasoningNextStep = "answer";
  if (actionRequested && (risk === "critical" || risk === "high")) nextStep = "human_gate";
  else if (missingEvidence.length >= 2) nextStep = "clarify";
  else if (external) nextStep = "research";
  else if (missingEvidence.length === 1) nextStep = "verify";

  const confidence = Math.max(60, Math.min(99, 96 - missingEvidence.length * 10 - (q.length < 8 ? 15 : 0)));

  return { version: 1, intent, confidence, risk, nextStep, evidenceRequired, missingEvidence, constraints, signals };
}
