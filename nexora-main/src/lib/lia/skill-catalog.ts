/**
 * Curated Nexo capability catalog.
 *
 * These are capability descriptions, not permissions. Execution still goes
 * through the existing Skill Runtime + Policy Engine.
 */
export type NexoSkillCapability = {
  id: string;
  category: "finance" | "agentic" | "memory" | "knowledge" | "interaction" | "security";
  description: string;
  risk: "read" | "recommendation" | "write" | "critical";
  requiredTools: readonly string[];
};

const READ_FINANCE = [
  "get_financial_snapshot",
  "get_budget_status",
  "get_cashflow",
  "get_wealth_snapshot",
  "get_forecast",
  "search_transactions",
] as const;

export const NEXO_SKILL_CATALOG: readonly NexoSkillCapability[] = [
  ["budget-health","finance","Évaluer la santé du budget et ses écarts.","read",READ_FINANCE],
  ["cashflow-health","finance","Analyser entrées, sorties et marge de trésorerie.","read",READ_FINANCE],
  ["spending-anomaly","finance","Repérer des variations de dépenses nécessitant vérification.","read",READ_FINANCE],
  ["recurring-expenses","finance","Identifier les charges récurrentes à partir des données autorisées.","read",READ_FINANCE],
  ["forecast-review","finance","Comparer prévisions, réalisé et hypothèses.","read",READ_FINANCE],
  ["savings-capacity","finance","Estimer une capacité d'épargne conditionnelle.","recommendation",READ_FINANCE],
  ["scenario-simulation","finance","Comparer des scénarios avec hypothèses explicites.","recommendation",READ_FINANCE],
  ["wealth-review","finance","Analyser l'évolution du patrimoine observé.","read",["get_wealth_snapshot"]],
  ["financial-goal-plan","finance","Décomposer un objectif financier en étapes vérifiables.","recommendation",READ_FINANCE],
  ["risk-review","finance","Hiérarchiser les risques financiers observés.","recommendation",READ_FINANCE],
  ["budget-drift","finance","Identifier les enveloppes qui dérivent du plan.","read",READ_FINANCE],
  ["transaction-patterns","finance","Analyser des motifs récurrents dans les transactions.","read",["search_transactions"]],
  ["agent-planning","agentic","Décomposer une demande en étapes bornées.","read",[]],
  ["agent-verification","agentic","Vérifier les résultats avant de conclure.","read",[]],
  ["agent-critique","agentic","Chercher les contradictions et hypothèses fragiles.","read",[]],
  ["agent-recovery","agentic","Récupérer proprement après un échec d'outil.","read",[]],
  ["agent-source-comparison","agentic","Comparer plusieurs sources avant une conclusion.","read",["research_web"]],
  ["agent-trajectory-audit","agentic","Évaluer l'efficacité et la sécurité d'une trajectoire agentique.","read",[]],
  ["memory-recall","memory","Récupérer un souvenir pertinent sans en faire une preuve financière.","read",[]],
  ["memory-consolidation","memory","Proposer une consolidation de souvenirs existants.","recommendation",[]],
  ["memory-conflict-review","memory","Détecter des souvenirs contradictoires avant réutilisation.","read",[]],
  ["memory-explicit-preference","memory","Mémoriser une préférence explicitement demandée.","recommendation",[]],
  ["knowledge-research","knowledge","Rechercher des sources publiques utiles.","read",["research_web"]],
  ["knowledge-synthesis","knowledge","Synthétiser des sources en séparant faits et hypothèses.","read",["research_web"]],
  ["knowledge-freshness","knowledge","Vérifier si une connaissance est devenue obsolète.","read",[]],
  ["page-context","interaction","Adapter l'explication à la page Nexora courante.","read",[]],
  ["friction-detection","interaction","Détecter des signaux faibles de friction sans collecter le DOM.","read",[]],
  ["prompt-injection-defense","security","Identifier et neutraliser des instructions non fiables.","read",[]],
  ["tool-boundary-validation","security","Vérifier qu'un outil respecte son contrat et son risque.","critical",[]],
  ["data-isolation","security","Vérifier la séparation stricte entre utilisateurs.","critical",[]],
  ["write-preflight","security","Effectuer les contrôles avant toute écriture sensible.","critical",[]],
].map(([id,category,description,risk,requiredTools]) => ({ id, category, description, risk, requiredTools })) as readonly NexoSkillCapability[];

export function getNexoSkillCapability(id: string) {
  return NEXO_SKILL_CATALOG.find(skill => skill.id === id) ?? null;
}
