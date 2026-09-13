export type LiaEvidenceItem = {
  id: string;
  label: string;
  value: string;
  source: string;
  state: "verified" | "observed" | "assumed" | "missing";
  confidence: "high" | "medium" | "low";
};

export type LiaExplainability = {
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  evidence: LiaEvidenceItem[];
  assumptions: string[];
  limitations: string[];
  checks: string[];
  nextAction: string;
};

function eur(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

/**
 * Builds a user-facing evidence summary from server-observed facts.
 * It deliberately exposes facts/provenance, not the model's private chain of thought.
 */
export function buildLiaExplainability(input: {
  balance: number;
  income90d: number;
  expense90d: number;
  transactionCount: number;
  accountCount: number;
  budgets: unknown[];
  goals: unknown[];
  forecasts: unknown[];
  fixedExpenses: unknown[];
  toolResults: Record<string, unknown>;
}): LiaExplainability {
  const evidence: LiaEvidenceItem[] = [
    { id: "balance", label: "Solde observé", value: eur(input.balance), source: "Supabase · comptes", state: "verified", confidence: input.accountCount ? "high" : "low" },
    { id: "income-90d", label: "Revenus sur 90 jours", value: eur(input.income90d), source: "Supabase · transactions", state: "observed", confidence: input.transactionCount ? "high" : "low" },
    { id: "expense-90d", label: "Dépenses sur 90 jours", value: eur(input.expense90d), source: "Supabase · transactions", state: "observed", confidence: input.transactionCount ? "high" : "low" },
    { id: "transactions", label: "Transactions analysées", value: String(input.transactionCount), source: "Supabase · transactions", state: "verified", confidence: input.transactionCount ? "high" : "medium" },
    { id: "budgets", label: "Budgets disponibles", value: String(input.budgets.length), source: "Supabase · budgets", state: input.budgets.length ? "verified" : "missing", confidence: input.budgets.length ? "high" : "low" },
    { id: "forecasts", label: "Prévisions disponibles", value: String(input.forecasts.length), source: "Supabase · forecasts", state: input.forecasts.length ? "verified" : "missing", confidence: input.forecasts.length ? "high" : "low" },
    { id: "fixed", label: "Charges fixes actives", value: String(input.fixedExpenses.length), source: "Supabase · fixed_expenses", state: input.fixedExpenses.length ? "verified" : "missing", confidence: input.fixedExpenses.length ? "high" : "medium" },
  ];

  const successfulTools = Object.values(input.toolResults).filter((result) => !(result && typeof result === "object" && "error" in result)).length;
  const toolCount = Object.keys(input.toolResults).length;
  const completeness = [input.accountCount > 0, input.transactionCount > 0, input.budgets.length > 0 || input.forecasts.length > 0].filter(Boolean).length;
  const confidenceScore = Math.max(25, Math.min(96, 45 + completeness * 14 + (toolCount ? 8 : 0) + (successfulTools === toolCount && toolCount ? 8 : 0)));
  const confidence = confidenceScore >= 80 ? "high" : confidenceScore >= 60 ? "medium" : "low";

  const assumptions: string[] = [
    "Les données observées couvrent principalement les 90 derniers jours.",
    "Les engagements futurs et les scénarios sont interprétés comme des hypothèses de planification, pas comme des transactions réalisées.",
  ];
  const limitations: string[] = [];
  if (!input.budgets.length) limitations.push("Aucun budget récent exploitable n'a été trouvé.");
  if (!input.forecasts.length) limitations.push("Aucune prévision exploitable n'a été trouvée.");
  if (!input.transactionCount) limitations.push("Aucune transaction récente n'est disponible pour comparer le réel.");
  if (toolCount && successfulTools < toolCount) limitations.push(`${toolCount - successfulTools} outil(s) déterministe(s) n'ont pas fourni de résultat exploitable.`);

  return {
    confidence,
    confidenceScore,
    evidence,
    assumptions,
    limitations,
    checks: [
      "Données financières chargées côté serveur.",
      "Résultats des outils déterministes comparés avant génération.",
      "Aucune opération financière irréversible autorisée par cette conversation.",
    ],
    nextAction: limitations.length ? "Compléter les données manquantes puis relancer la vérification." : "Recontrôler ces éléments si le contexte financier change.",
  };
}
