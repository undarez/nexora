export type LiaDecision = "answer_with_data" | "research" | "clarify";

export type LiaDecisionResult = {
  decision: LiaDecision;
  confidence: number;
  reason: string;
  missing: string[];
  externalResearch: boolean;
  clarification?: string;
};

const EXTERNAL_PATTERNS = /\b(actuel|actuelle|aujourd|aujourd'hui|cette semaine|ce mois|2026|inflation|taux|euribor|règlement|reglement|loi|légal|legale|légale|norme|rgpd|cnil|amf|acpr|marché|marches|marchés|prix|tarif|plafond|seuil|barème|bareme|impôt|impot|fiscal|smic|salaire|tendance|actualité|actualite|news|source|officiel|officielle|vérifie|verifie|recherche|internet|web)\b/i;
const AMBIGUOUS = /^(ça|ca|cela|c'est|et|pourquoi|comment|combien|qu'en penses[- ]tu|et après|ensuite|oui|non|ok|d'accord)[?!.,\s]*$/i;
const PERSONAL_DATA = /\b(mon|ma|mes|moi|chez moi|dans mon budget|mon compte|mes comptes|mes dépenses|mes depenses|mon salaire|mes revenus|mon patrimoine|mes économies|mes economies)\b/i;

/**
 * Deterministic routing only. The model never decides whether it may browse.
 * Priority: clarify an unusable request, otherwise research when external
 * facts are explicitly requested/required, otherwise use server financial data.
 */
export function routeLiaQuestion(question: string, available: {
  hasAccounts: boolean;
  hasTransactions: boolean;
  hasBudgets: boolean;
  hasForecasts: boolean;
}) : LiaDecisionResult {
  const q = question.trim();
  if (q.length < 3 || AMBIGUOUS.test(q)) {
    return {
      decision: "clarify",
      confidence: 96,
      reason: "La demande ne contient pas assez d'éléments pour choisir correctement les données ou la recherche nécessaires.",
      missing: ["objectif précis"],
      externalResearch: false,
      clarification: "Que veux-tu que j'analyse précisément ? Donne-moi l'objectif ou le montant concerné.",
    };
  }

  if (EXTERNAL_PATTERNS.test(q)) {
    return {
      decision: "research",
      confidence: 91,
      reason: "La question contient une dépendance à une information externe, actuelle, réglementaire ou explicitement recherchée.",
      missing: [],
      externalResearch: true,
    };
  }

  const needsPersonalContext = PERSONAL_DATA.test(q);
  const missing: string[] = [];
  if (needsPersonalContext && !available.hasAccounts) missing.push("comptes");
  if (needsPersonalContext && !available.hasTransactions) missing.push("transactions");
  if (/budget|enveloppe|dépense|depense/i.test(q) && !available.hasBudgets) missing.push("budget");
  if (/prévision|prevision|projection|avenir|mois prochain|prochains mois/i.test(q) && !available.hasForecasts) missing.push("prévisions");

  if (missing.length >= 2) {
    return {
      decision: "clarify",
      confidence: 89,
      reason: "Plusieurs jeux de données indispensables sont absents du contexte serveur disponible.",
      missing,
      externalResearch: false,
      clarification: `Je peux t'aider, mais il me manque : ${missing.join(", ")}. Que veux-tu vérifier exactement ?`,
    };
  }

  return {
    decision: "answer_with_data",
    confidence: 94,
    reason: "Les informations nécessaires relèvent du contexte financier serveur déjà disponible ; aucune recherche externe n'est requise.",
    missing,
    externalResearch: false,
  };
}
