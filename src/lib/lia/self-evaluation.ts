/** V5.08.51 — deterministic response evaluation and bounded self-correction. */
export type LiaEvaluationFinding = { code: string; severity: "info" | "warning" | "blocking"; message: string; correction: string };
export type LiaResponseEvaluation = {
  version: 1;
  score: number;
  verdict: "accepted" | "corrected" | "blocked";
  findings: LiaEvaluationFinding[];
  corrected: boolean;
  authority: { financialWriteAuthorized: false; selfAuthorizationAllowed: false; policyEngineAuthoritative: true; decisionGateAuthoritative: true };
  invariants: string[];
};

const INVARIANTS = [
  "self_evaluation_never_authorizes_financial_write",
  "self_correction_never_writes_authority",
  "unsupported_financial_claims_are_not_created",
  "source_truth_hierarchy_is_preserved",
  "policy_engine_and_decision_gate_remain_authoritative",
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

export function evaluateAndCorrectLiaResponse(args: {
  response: string;
  question: string;
  financialContextAvailable: boolean;
  externalResearchAvailable?: boolean;
  critiqueBlocked?: boolean;
  recommendationPresent?: boolean;
}): { response: string; evaluation: LiaResponseEvaluation } {
  const findings: LiaEvaluationFinding[] = [];
  let corrected = args.response;
  const lower = args.response.toLowerCase();

  if (args.critiqueBlocked && /\b(j'ai|je vais|j’exécute|j'exécute|effectué|effectue|virement|transfert)\b/i.test(args.response)) {
    findings.push({ code: "CRITIQUE_ACTION_CONTRADICTION", severity: "blocking", message: "La réponse semble présenter une action sensible comme exécutée malgré un blocage cognitif.", correction: "Reformuler en recommandation/proposition soumise à validation humaine." });
  }

  if (/\b(virement effectué|virement réalisé|paiement effectué|j'ai payé|j’ai payé|transfert effectué)\b/i.test(lower)) {
    findings.push({ code: "UNVERIFIED_FINANCIAL_ACTION", severity: "blocking", message: "Une exécution financière est affirmée sans preuve d'exécution fournie au moteur.", correction: "Remplacer l'affirmation d'exécution par une formulation conditionnelle et rappeler la validation humaine." });
  }

  if (!args.financialContextAvailable && /\bton solde|votre solde|tes dépenses|vos dépenses|tu as dépensé|vous avez dépensé\b/i.test(lower)) {
    findings.push({ code: "MISSING_FINANCIAL_CONTEXT", severity: "blocking", message: "La réponse présente des faits financiers sans contexte financier disponible.", correction: "Indiquer que les données financières nécessaires ne sont pas disponibles plutôt que d'inférer un montant." });
  }

  if (args.recommendationPresent && /\btu dois absolument|vous devez absolument|fais-le maintenant|faites-le maintenant\b/i.test(lower)) {
    findings.push({ code: "OVERSTATED_DIRECTIVE", severity: "warning", message: "La recommandation est formulée comme une instruction impérative trop forte.", correction: "Présenter l'option comme une recommandation soumise à la décision de l'utilisateur." });
  }

  if (args.externalResearchAvailable === false && /\bselon une étude|d'après une étude|la loi impose|la réglementation exige|officiellement\b/i.test(lower)) {
    findings.push({ code: "UNVERIFIED_EXTERNAL_FACT", severity: "warning", message: "La réponse emploie une formulation externe qui nécessite une source vérifiée.", correction: "Qualifier l'énoncé ou demander une recherche contrôlée avant de le présenter comme fait." });
  }

  const blocking = findings.filter(f => f.severity === "blocking");
  const warnings = findings.filter(f => f.severity === "warning");
  if (blocking.length) {
    corrected = `${args.response}\n\nVérification LIA : certaines affirmations nécessitent une correction avant d'être considérées comme fiables. ${blocking.map(f => f.correction).join(" ")} Aucune action financière n'a été exécutée par cette réponse.`;
  } else if (warnings.length) {
    corrected = `${args.response}\n\nPrécaution LIA : ${warnings.map(f => f.correction).join(" ")}`;
  }

  const score = clamp(100 - blocking.length * 45 - warnings.length * 15);
  return {
    response: corrected,
    evaluation: {
      version: 1,
      score,
      verdict: blocking.length ? "corrected" : warnings.length ? "corrected" : "accepted",
      findings,
      corrected: corrected !== args.response,
      authority: { financialWriteAuthorized: false, selfAuthorizationAllowed: false, policyEngineAuthoritative: true, decisionGateAuthoritative: true },
      invariants: INVARIANTS,
    },
  };
}
