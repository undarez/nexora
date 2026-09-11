export type LiaImpactPreview = {
  generatedAt: string;
  actionKey: string;
  riskClass: string;
  reversible: boolean;
  financialMutation: boolean;
  summary: string;
  impacts: Array<{ label: string; value: string; direction: "positive" | "negative" | "neutral" | "unknown" }>;
  assumptions: string[];
  warnings: string[];
  checks: string[];
};

function amount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Number(value.toFixed(2));
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
  }
  return null;
}

function impact(label: string, value: number, direction?: LiaImpactPreview["impacts"][number]["direction"]) {
  return { label, value: `${value >= 0 ? "+" : ""}${value.toFixed(2)} €`, direction: direction ?? (value > 0 ? "positive" : value < 0 ? "negative" : "neutral") };
}

/**
 * Preview only: this function never mutates financial data and never authorizes an action.
 * It reports only explicit numeric deltas supplied by the already-created proposal.
 */
export function buildLiaImpactPreview(args: {
  actionKey: string;
  riskClass: string;
  reversible: boolean;
  payload: Record<string, unknown>;
}): LiaImpactPreview {
  const payload = args.payload;
  const impacts: LiaImpactPreview["impacts"] = [];
  const assumptions: string[] = [];
  const warnings: string[] = [];

  const balanceDelta = amount(payload.balance_delta ?? payload.balanceDelta);
  const budgetDelta = amount(payload.budget_delta ?? payload.budgetDelta);
  const envelopeDelta = amount(payload.envelope_delta ?? payload.envelopeDelta);
  const amountValue = amount(payload.amount);

  if (balanceDelta !== null) impacts.push(impact("Variation de solde annoncée", balanceDelta));
  if (budgetDelta !== null) impacts.push(impact("Variation de budget annoncée", budgetDelta));
  if (envelopeDelta !== null) impacts.push(impact("Variation d'enveloppe annoncée", envelopeDelta));
  if (amountValue !== null && impacts.length === 0) impacts.push(impact("Montant de l'action", amountValue, amountValue > 0 ? "positive" : amountValue < 0 ? "negative" : "neutral"));

  const financialMutation = args.actionKey !== "create_recommendation";
  if (args.actionKey === "create_recommendation") {
    return {
      generatedAt: new Date().toISOString(),
      actionKey: args.actionKey,
      riskClass: args.riskClass,
      reversible: args.reversible,
      financialMutation: false,
      summary: "Cette proposition crée une recommandation. Elle ne modifie pas directement le solde, le budget ou les comptes.",
      impacts: impacts.length ? impacts : [{ label: "Données financières", value: "Aucune modification directe", direction: "neutral" }],
      assumptions: ["Les montants éventuels ci-dessus sont des impacts hypothétiques explicitement fournis par la proposition."],
      warnings: ["L'aperçu ne constitue pas une exécution et ne garantit pas l'effet futur d'une recommandation."],
      checks: ["Action identifiée", "Aucune mutation financière directe détectée", "Validation humaine toujours requise"],
    };
  }

  if (!impacts.length) warnings.push("Aucun impact numérique explicite n'est disponible : l'effet ne doit pas être inventé.");
  assumptions.push("Les impacts sont calculés uniquement à partir des valeurs explicites de la proposition.");
  return {
    generatedAt: new Date().toISOString(), actionKey: args.actionKey, riskClass: args.riskClass, reversible: args.reversible,
    financialMutation, summary: financialMutation ? "Cette action est susceptible de modifier des données et nécessite une validation serveur adaptée." : "Aucune mutation détectée.",
    impacts, assumptions, warnings, checks: ["Proposition authentifiée", "Impact limité aux données explicitement fournies", "Aucune écriture exécutée pendant l'aperçu"],
  };
}
