export type AgentToolRisk = "read" | "recommendation" | "write-sensitive";
export type AgentToolDefinition = { name: string; description: string; risk: AgentToolRisk; deterministic: boolean; requiresUserApproval: boolean };

export const AGENT_TOOLS: AgentToolDefinition[] = [
  { name: "get_financial_snapshot", description: "Lire le snapshot financier de l'utilisateur authentifié.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "get_budget_status", description: "Calculer budget versus réel.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "get_cashflow", description: "Calculer les flux de trésorerie observés.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "get_wealth_snapshot", description: "Calculer le patrimoine à partir des entrées datées.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "get_forecast", description: "Lire les prévisions persistées et leurs scénarios.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "search_transactions", description: "Rechercher les transactions de l'utilisateur.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "search_use_cases", description: "Rechercher les Use Cases métier adaptés à l’objectif.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "search_skills", description: "Rechercher les skills procéduraux validés pour la tâche.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "learn_use_case", description: "Créer un Use Case candidat à partir d’une expérience ou d’une nouvelle fonctionnalité.", risk: "recommendation", deterministic: true, requiresUserApproval: false },
  { name: "learn_skill", description: "Transformer une procédure validée ou une correction en skill candidat réutilisable.", risk: "recommendation", deterministic: true, requiresUserApproval: false },
  { name: "create_recommendation", description: "Proposer une recommandation vérifiée ; exécution persistante soumise à validation humaine.", risk: "recommendation", deterministic: true, requiresUserApproval: true },
  { name: "save_financial_insight", description: "Enregistrer une observation financière non transactionnelle et réversible.", risk: "recommendation", deterministic: true, requiresUserApproval: false },
  { name: "create_cron_job", description: "Planifier une boucle LIA bornée pour une action de lecture gouvernée.", risk: "recommendation", deterministic: true, requiresUserApproval: false },
];

export function getAgentTool(name: string) { return AGENT_TOOLS.find((tool) => tool.name === name); }
