import type { LiaAgentDefinition, LiaSpecialistId } from "./types.ts";

export const LIA_AGENT_DEFINITIONS: LiaAgentDefinition[] = [
  {
    id: "copywriting",
    label: "Copywriting",
    purpose: "Créer, reformuler et contrôler les contenus Nexora sans publication implicite.",
    skills: ["content-generation", "ux-copy", "email-copy"],
    permissions: ["content.read", "content.write"],
    maxSteps: 4,
    maxRetriesPerStep: 2,
    autonomyLevel: 2,
    requiresHumanApprovalFor: ["write", "critical"],
    verifyRequired: true,
  },
  {
    id: "seo",
    label: "SEO",
    purpose: "Auditer le SEO technique et éditorial puis proposer des améliorations vérifiables.",
    skills: ["technical-seo", "keyword-analysis", "metadata"],
    permissions: ["seo.read", "content.read"],
    maxSteps: 5,
    maxRetriesPerStep: 2,
    autonomyLevel: 2,
    requiresHumanApprovalFor: ["write", "critical"],
    verifyRequired: true,
  },
  {
    id: "system-admin",
    label: "System Admin",
    purpose: "Diagnostiquer la santé technique et proposer des corrections bornées, sans auto-déploiement implicite.",
    skills: ["system-health", "system-diagnostics", "build-analysis"],
    permissions: ["system.read", "system.write"],
    maxSteps: 6,
    maxRetriesPerStep: 2,
    autonomyLevel: 2,
    requiresHumanApprovalFor: ["write", "critical"],
    verifyRequired: true,
  },
  {
    id: "data",
    label: "Data Manager",
    purpose: "Contrôler qualité, cohérence, doublons et anomalies des données avant toute mutation.",
    skills: ["data-quality", "data-deduplication", "anomaly-detection"],
    permissions: ["data.read", "data.write"],
    maxSteps: 6,
    maxRetriesPerStep: 2,
    autonomyLevel: 2,
    requiresHumanApprovalFor: ["write", "critical"],
    verifyRequired: true,
  },
  {
    id: "finance",
    label: "Finance",
    purpose: "Analyser les données financières et piloter les objectifs dans les limites de la politique LIA.",
    skills: ["finance-analytics", "financial-reasoning", "goal-lifecycle"],
    permissions: ["finance.read", "finance.write"],
    maxSteps: 6,
    maxRetriesPerStep: 2,
    autonomyLevel: 2,
    requiresHumanApprovalFor: ["write", "critical"],
    verifyRequired: true,
  },
  {
    id: "mobility",
    label: "Mobility",
    purpose: "Calculer les coûts de mobilité, carburant, trajets et véhicules.",
    skills: ["mobility-fuel", "mobility-profile"],
    permissions: ["mobility.read"],
    maxSteps: 4,
    maxRetriesPerStep: 2,
    autonomyLevel: 2,
    requiresHumanApprovalFor: ["write", "critical"],
    verifyRequired: true,
  },
  {
    id: "research",
    label: "Research",
    purpose: "Rechercher et synthétiser des sources avec les budgets et règles de confiance de Nexora.",
    skills: ["tavily-search", "tavily-research", "source-trust"],
    permissions: ["research.read"],
    maxSteps: 6,
    maxRetriesPerStep: 2,
    autonomyLevel: 2,
    requiresHumanApprovalFor: ["write", "critical"],
    verifyRequired: true,
  },
];

export function getLiaAgentDefinition(id: string): LiaAgentDefinition | null {
  return LIA_AGENT_DEFINITIONS.find((agent) => agent.id === id) ?? null;
}

export function isLiaSpecialistId(id: string): id is LiaSpecialistId {
  return LIA_AGENT_DEFINITIONS.some((agent) => agent.id === id);
}
