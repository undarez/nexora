import type { AgentToolDefinition } from "./tool-definition";
export type { AgentToolDefinition } from "./tool-definition";

export const AGENT_TOOLS: AgentToolDefinition[] = [
  { name: "search_use_cases", description: "Rechercher les Use Cases métier adaptés à l’objectif.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "search_skills", description: "Rechercher les skills procéduraux validés pour la tâche.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "research_web", description: "Effectuer une recherche web serveur bornée et en lecture seule dans la cage de recherche de confiance.", risk: "read", deterministic: false, requiresUserApproval: false },
  { name: "learn_use_case", description: "Créer un Use Case candidat à partir d’une expérience ou d’une nouvelle fonctionnalité.", risk: "recommendation", deterministic: true, requiresUserApproval: false },
  { name: "learn_skill", description: "Transformer une procédure validée ou une correction en skill candidat réutilisable.", risk: "recommendation", deterministic: true, requiresUserApproval: false },
  { name: "create_recommendation", description: "Proposer une recommandation vérifiée ; exécution persistante soumise à validation humaine.", risk: "recommendation", deterministic: true, requiresUserApproval: true },
];

export function getAgentTool(name: string) {
  return AGENT_TOOLS.find((tool) => tool.name === name);
}
