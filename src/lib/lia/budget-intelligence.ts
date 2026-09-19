/**
 * Budget Intelligence Layer v1.
 *
 * This module is intentionally deterministic: it defines how LIA should route
 * budget knowledge, observations, commitments, forecasts, scenarios and
 * education. It never authorizes a financial write.
 */
export type BudgetIntelligenceLayer =
  | "public_context"
  | "household_observation"
  | "classification"
  | "commitments"
  | "forecasting"
  | "scenarios"
  | "education"
  | "governance";

export const BUDGET_INTELLIGENCE_LAYERS: ReadonlyArray<{
  id: BudgetIntelligenceLayer;
  label: string;
  purpose: string;
}> = [
  { id: "public_context", label: "Connaissance publique", purpose: "Faits économiques, réglementaires et éducatifs sourcés." },
  { id: "household_observation", label: "Observation foyer", purpose: "Flux réellement observés, séparés des statistiques nationales." },
  { id: "classification", label: "Classification", purpose: "Qualification des flux avant toute interprétation." },
  { id: "commitments", label: "Engagements futurs", purpose: "Sorties futures issues des abonnements, crédits, échéances et contrats." },
  { id: "forecasting", label: "Prévision", purpose: "Projection avec hypothèses, fiabilité et comparaison au réalisé." },
  { id: "scenarios", label: "Scénarios", purpose: "Stress tests conditionnels, jamais présentés comme des faits." },
  { id: "education", label: "Éducation financière", purpose: "Explication courte au moment où le concept devient utile." },
  { id: "governance", label: "Gouvernance", purpose: "Provenance, fraîcheur, confiance, conflits et revalidation." },
];

export const BUDGET_INTELLIGENCE_INVARIANTS = [
  "transaction_is_not_expense",
  "internal_transfer_is_not_consumption",
  "installment_creates_future_commitment",
  "subscription_is_recurring_commitment",
  "credit_is_liability_plus_future_cashflow",
  "overdraft_is_liquidity_event",
  "macro_indicator_is_context_not_household_diagnosis",
  "anticipation_is_not_forecast",
  "scenario_is_not_fact",
  "provisional_is_not_definitive",
  "contract_rate_is_not_central_bank_rate",
  "eligibility_requires_official_verification",
  "no_overindebtedness_diagnosis_from_transactions_alone",
  "no_personalized_investment_recommendation",
  "macro_context_never_silently_modifies_budget",
  "time_sensitive_knowledge_requires_revalidation",
] as const;

const TOPIC_RULES: Array<{ layer: BudgetIntelligenceLayer; terms: RegExp }> = [
  { layer: "commitments", terms: /abonnement|cr[eé]dit|paiement fractionn|mensualit|assurance|imp[oô]t|[eé]ch[eé]ance|engagement/i },
  { layer: "scenarios", terms: /sc[eé]nario|stress|choc|si .* augmente|si .* baisse|sensibilit/i },
  { layer: "forecasting", terms: /pr[eé]vision|pr[eé]voir|projection|futur|tr[eé]sorerie|marge|fiabilit/i },
  { layer: "classification", terms: /transaction|d[eé]pense|revenu|virement|transfert|[eé]pargne|remboursement|frais/i },
  { layer: "public_context", terms: /inflation|bce|banque de france|irl|gaz|carburant|r[eé]glement|loi|taux|indice/i },
  { layer: "education", terms: /explique|comprendre|[eé]ducation|c'est quoi|comment fonctionne|apprendre/i },
];

export function routeBudgetIntelligenceLayers(question: string): BudgetIntelligenceLayer[] {
  const selected = TOPIC_RULES.filter(rule => rule.terms.test(question)).map(rule => rule.layer);
  if (!selected.length) return ["household_observation", "classification", "governance"];
  return Array.from(new Set<BudgetIntelligenceLayer>(["household_observation", ...selected, "governance"]));;
}

export type BudgetIntelligenceKnowledge = {
  title: string;
  statement: string;
  confidence: number;
  authority: string;
  sourceName?: string | null;
};

export type BudgetIntelligenceObservation = {
  label: string;
  cadence?: string | null;
  typicalAmount?: number | null;
  occurrences?: number | null;
  confidence?: number | null;
};

export type BudgetIntelligenceContext = {
  version: "1.0";
  layers: BudgetIntelligenceLayer[];
  invariants: typeof BUDGET_INTELLIGENCE_INVARIANTS;
  validatedKnowledge: Array<Pick<BudgetIntelligenceKnowledge, "title" | "statement" | "confidence" | "authority">>;
  observedHabits: Array<Pick<BudgetIntelligenceObservation, "label" | "cadence" | "typicalAmount" | "occurrences" | "confidence">>;
  interpretationRules: string[];
};

export function buildBudgetIntelligenceContext(
  question: string,
  knowledge: BudgetIntelligenceKnowledge[] = [],
  habits: BudgetIntelligenceObservation[] = [],
): BudgetIntelligenceContext {
  const layers = routeBudgetIntelligenceLayers(question);
  const validatedKnowledge = knowledge
    .filter(item => Number.isFinite(item.confidence) && item.confidence >= 0.65)
    .slice(0, 8)
    .map(item => ({ title: item.title, statement: item.statement, confidence: item.confidence, authority: item.authority }));
  const observedHabits = habits
    .filter(item => item.confidence == null || item.confidence >= 0.75)
    .slice(0, 8)
    .map(item => ({ label: item.label, cadence: item.cadence ?? null, typicalAmount: item.typicalAmount ?? null, occurrences: item.occurrences ?? null, confidence: item.confidence ?? null }));
  return {
    version: "1.0",
    layers,
    invariants: BUDGET_INTELLIGENCE_INVARIANTS,
    validatedKnowledge,
    observedHabits,
    interpretationRules: [
      "Les flux observés du foyer priment sur les agrégats publics pour le diagnostic budgétaire.",
      "Un engagement futur est séparé du flux déjà réalisé.",
      "Une habitude observée n'est pas une obligation contractuelle.",
      "Une prévision doit exposer ses hypothèses et rester distincte du réalisé.",
      "Un scénario doit rester conditionnel et ne doit jamais modifier silencieusement le budget.",
      "Une information publique sensible au temps doit être revalidée avant d'être utilisée comme fait actuel.",
    ],
  };
}

export function buildBudgetIntelligencePrompt(question: string, knowledge: Array<{ title: string; statement: string; confidence: number; authority: string; sourceName?: string | null }>): string {
  const layers = routeBudgetIntelligenceLayers(question);
  const relevant = knowledge
    .filter(item => item.confidence >= 0.65)
    .slice(0, 8)
    .map(item => ({ title: item.title, statement: item.statement, confidence: item.confidence, authority: item.authority, source: item.sourceName ?? null }));
  return `\n\nNEXORA BUDGET INTELLIGENCE LAYER:\n${JSON.stringify({ layers, invariants: BUDGET_INTELLIGENCE_INVARIANTS, knowledge: relevant })}\nRègle : la connaissance publique fournit du contexte et des preuves ; les observations du foyer restent prioritaires pour le diagnostic budgétaire ; les scénarios et prévisions restent conditionnels ; aucune connaissance n'autorise une écriture financière.`;
}
