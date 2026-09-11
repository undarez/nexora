/** V5.08.43 — deterministic decision & recommendation layer. */
export type LiaRecommendationPriority = "low" | "medium" | "high" | "critical";
export type LiaRecommendationConfidence = "low" | "medium" | "high";

export type LiaRecommendation = {
  id: string;
  title: string;
  objective: string;
  priority: LiaRecommendationPriority;
  recommendation: string;
  rationale: string[];
  facts: Array<{ label: string; value: string }>;
  options: Array<{ key: string; label: string; tradeoff: string }>;
  estimatedImpact: { label: string; value: string; direction: "positive" | "negative" | "neutral" | "unknown" }[];
  confidence: LiaRecommendationConfidence;
  confidenceScore: number;
  risks: string[];
  assumptions: string[];
  limitations: string[];
  evidence: string[];
  actionability: "informational" | "user_decision";
  humanApprovalRequired: true;
};

const euro = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)} €`;

export function buildLiaRecommendation(args: {
  objective: string;
  balance: number;
  income90d: number;
  expense90d: number;
  transactionCount: number;
  hasBudget: boolean;
  budgetDrift?: number | null;
  riskSignals?: number;
  confidenceScore?: number;
}): LiaRecommendation {
  const monthlyIncome = args.income90d / 3;
  const monthlyExpense = args.expense90d / 3;
  const monthlyNet = monthlyIncome - monthlyExpense;
  const margin = monthlyIncome > 0 ? monthlyNet / monthlyIncome : null;
  const risks: string[] = [];
  const assumptions: string[] = [];
  const limitations: string[] = [];
  const facts: Array<{label:string;value:string}> = [];
  const evidence: string[] = [];
  const options: LiaRecommendation["options"] = [];
  const impacts: LiaRecommendation["estimatedImpact"] = [];

  facts.push({ label: "Solde observé", value: euro(args.balance) });
  facts.push({ label: "Revenus observés (90 j)", value: euro(args.income90d) });
  facts.push({ label: "Dépenses observées (90 j)", value: euro(args.expense90d) });
  facts.push({ label: "Flux net moyen mensuel", value: euro(monthlyNet) });
  facts.push({ label: "Transactions analysées", value: String(args.transactionCount) });
  evidence.push("données financières observées sur les 90 derniers jours");

  let priority: LiaRecommendationPriority = "low";
  let title = "Conserver une surveillance financière régulière";
  let recommendation = "Poursuis le suivi des flux et recontrôle la situation avant toute décision financière importante.";
  let rationale = ["Les données disponibles ne justifient pas à elles seules une action financière immédiate."];

  if (margin !== null && margin < 0) {
    priority = args.balance < Math.abs(monthlyNet) ? "critical" : "high";
    title = "Réduire le déficit mensuel observé";
    recommendation = "Priorise l’identification des dépenses compressibles et établis un plan de retour à un flux mensuel positif.";
    rationale = ["Les dépenses observées dépassent les revenus observés en rythme moyen.", "Un déficit récurrent peut réduire progressivement la marge de sécurité de trésorerie."];
    impacts.push({ label: "Flux mensuel", value: euro(monthlyNet), direction: "negative" });
    options.push({ key: "reduce_expenses", label: "Réduire les dépenses variables", tradeoff: "Effort immédiat mais amélioration potentielle du flux mensuel." });
    options.push({ key: "increase_income", label: "Augmenter les revenus", tradeoff: "Potentiel d’amélioration plus élevé mais dépend d’éléments externes." });
    risks.push("Une réduction trop agressive peut dégrader des dépenses nécessaires ou essentielles.");
  } else if (margin !== null && margin < 0.15) {
    priority = "medium";
    title = "Renforcer la marge de sécurité";
    recommendation = "Cherche en priorité à augmenter légèrement la marge mensuelle avant d’accroître les engagements récurrents.";
    rationale = ["Le flux mensuel moyen reste positif mais sa marge est relativement faible.", "Une marge limitée laisse moins de capacité d’absorption des dépenses exceptionnelles."];
    impacts.push({ label: "Flux mensuel moyen", value: euro(monthlyNet), direction: "positive" });
    options.push({ key: "buffer", label: "Constituer davantage de réserve", tradeoff: "Plus de sécurité, mais moins de liquidité disponible pour d’autres usages." });
    options.push({ key: "optimize", label: "Optimiser quelques postes de dépenses", tradeoff: "Effort modéré avec bénéfice potentiellement progressif." });
  } else {
    title = "Préserver la marge financière actuelle";
    recommendation = "Conserve la marge positive observée et utilise-la comme référence avant tout nouvel engagement récurrent.";
    rationale = ["Les flux observés présentent un solde moyen positif.", "La priorité est de préserver cette capacité plutôt que de supposer qu’elle restera constante."];
    impacts.push({ label: "Flux mensuel moyen", value: euro(monthlyNet), direction: "positive" });
    options.push({ key: "reserve", label: "Renforcer la réserve", tradeoff: "Sécurité accrue au prix d’une disponibilité moindre pour d’autres dépenses." });
    options.push({ key: "goal", label: "Accélérer un objectif existant", tradeoff: "Progression potentiellement plus rapide mais réserve moins élevée." });
  }

  if (args.hasBudget && args.budgetDrift !== null && args.budgetDrift !== undefined) {
    facts.push({ label: "Écart budgétaire observé", value: euro(args.budgetDrift) });
    evidence.push("budget et réel disponibles");
    if (args.budgetDrift < 0) {
      priority = priority === "low" ? "medium" : priority;
      risks.push("L’écart budgétaire négatif doit être interprété avec la progression de la période et les dépenses exceptionnelles.");
    }
  } else if (!args.hasBudget) {
    limitations.push("Aucun budget exploitable n’est disponible pour comparer précisément le prévu au réel.");
  }

  if ((args.riskSignals ?? 0) > 0) {
    risks.push(`${args.riskSignals} signal(s) de risque/anomalie déterministe doivent être vérifiés avant de conclure.`);
    priority = priority === "low" ? "medium" : priority;
    evidence.push("signaux de risque déterministes");
  }

  assumptions.push("Les montants futurs ne sont pas garantis : la recommandation s’appuie sur les observations disponibles.");
  assumptions.push("Un lien causal n’est pas déduit uniquement d’une corrélation entre catégories ou périodes.");
  limitations.push("Cette recommandation ne constitue ni un conseil financier personnalisé réglementé ni une instruction d’exécution.");
  limitations.push("Les données manquantes, récentes ou non catégorisées peuvent modifier la conclusion.");

  const score = Math.max(0, Math.min(1, (args.confidenceScore ?? 0.7) * (args.transactionCount > 0 ? 1 : 0.55)));
  const confidence: LiaRecommendationConfidence = score >= 0.8 ? "high" : score >= 0.55 ? "medium" : "low";

  return {
    id: `rec-${Date.now()}`,
    title, objective: args.objective.slice(0, 500), priority, recommendation, rationale, facts, options,
    estimatedImpact: impacts.length ? impacts : [{ label: "Impact", value: "Non quantifiable avec les données disponibles", direction: "unknown" }],
    confidence, confidenceScore: Number(score.toFixed(2)), risks, assumptions, limitations, evidence,
    actionability: "user_decision", humanApprovalRequired: true,
  };
}

export function formatLiaRecommendation(rec: LiaRecommendation): string {
  return `\n\nRECOMMANDATION NEXORA — ${rec.title}\nPriorité : ${rec.priority} · Confiance : ${rec.confidence} (${Math.round(rec.confidenceScore * 100)} %)\nRecommandation : ${rec.recommendation}\nPourquoi : ${rec.rationale.join(" ")}\nOptions : ${rec.options.map(o => `${o.label} (${o.tradeoff})`).join(" ; ")}\nLimites : ${rec.limitations.join(" ")}\nValidation humaine : requise. Cette recommandation ne déclenche aucune action financière.`;
}
