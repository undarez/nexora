export type SkillRisk = "read" | "recommendation" | "write" | "critical";
export type SkillCategory = "finance" | "agentic" | "interaction" | "security" | "knowledge" | "voice";
export type NexoraSkill = {
  id:string; version:string; name:string; description:string; category:SkillCategory; risk:SkillRisk;
  tools:readonly string[]; enabled:boolean; requiresHumanApproval:boolean; tags:readonly string[];
};

const READ = ["get_financial_snapshot","get_budget_status","get_cashflow","get_wealth_snapshot","get_forecast","search_transactions"] as const;
const WEB = ["research_web"] as const;
const SKILL_DATA: Array<[string,string,SkillCategory,SkillRisk,readonly string[],readonly string[]]> = [
["finance-budget-analysis","Analyse budgétaire","finance","read",READ,["budget","ecarts","enveloppes"]],
["finance-cashflow","Analyse de trésorerie","finance","read",READ,["cashflow","liquidite"]],
["finance-spending-anomaly","Détection d'anomalies","finance","read",READ,["anomalie","depenses"]],
["finance-recurring-expenses","Dépenses récurrentes","finance","read",READ,["recurrence","abonnements"]],
["finance-forecast","Contrôle des prévisions","finance","read",READ,["forecast","projection"]],
["finance-scenario","Simulation de scénarios","finance","recommendation",READ,["scenario","simulation"]],
["finance-savings-capacity","Capacité d'épargne","finance","recommendation",READ,["epargne","marge"]],
["finance-wealth","Analyse du patrimoine","finance","read",READ,["patrimoine","net-worth"]],
["finance-goal-planning","Planification d'objectif","finance","recommendation",READ,["objectif","plan"]],
["finance-risk-review","Revue des risques","finance","recommendation",READ,["risque","stress-test"]],
["finance-income-review","Analyse des revenus","finance","read",READ,["revenus","stabilite"]],
["finance-fixed-costs","Analyse des charges fixes","finance","read",READ,["charges","fixes"]],
["finance-budget-drift","Détection de dérive budgétaire","finance","read",READ,["budget","derive"]],
["finance-liquidity-buffer","Analyse du coussin de liquidité","finance","recommendation",READ,["liquidite","securite"]],
["finance-transaction-categorization","Contrôle de catégorisation","finance","read",READ,["transactions","categories"]],
["finance-monthly-review","Revue financière mensuelle","finance","read",READ,["mensuel","review"]],
["finance-financial-health","Score de santé financière","finance","recommendation",READ,["sante","score"]],
["finance-opportunity-scan","Recherche d'opportunités d'économie","finance","recommendation",READ,["economie","opportunite"]],
["agent-planning","Décomposition d'objectif","agentic","read",[],["planning","decomposition"]],
["agent-verification","Vérification des résultats","agentic","read",[],["verification","controle"]],
["agent-source-comparison","Comparaison de sources","agentic","read",WEB,["sources","evidence"]],
["agent-recovery","Récupération après erreur","agentic","read",[],["recovery","retry"]],
["agent-loop-detection","Détection de boucle","agentic","read",[],["loop","safety"]],
["agent-trajectory-review","Évaluation de trajectoire","agentic","read",[],["trajectory","eval"]],
["agent-cost-awareness","Contrôle coût/effort","agentic","read",[],["cost","budget"]],
["agent-web-research","Recherche web publique","knowledge","read",WEB,["web","research"]],
["agent-knowledge-synthesis","Synthèse de connaissances","knowledge","read",WEB,["knowledge","synthesis"]],
["knowledge-source-trust","Évaluation de fiabilité des sources","knowledge","read",WEB,["trust","sources"]],
["knowledge-contradiction-check","Détection de contradictions","knowledge","read",WEB,["contradiction","evidence"]],
["knowledge-fact-grounding","Ancrage factuel","knowledge","read",[],["grounding","facts"]],
["interaction-page-context","Contexte de page","interaction","read",[],["page","context"]],
["interaction-sequence-understanding","Compréhension de séquence","interaction","read",[],["sequence","behavior"]],
["interaction-friction","Détection de friction","interaction","read",[],["friction","ux"]],
["interaction-proactive-help","Aide proactive","interaction","recommendation",[],["proactive","copilot"]],
["interaction-explanation","Explication adaptée","interaction","read",[],["explain","ux"]],
["security-prompt-injection","Détection de prompt injection","security","read",[],["prompt-injection","web"]],
["security-tool-validation","Validation des outils","security","read",[],["tools","validation"]],
["security-data-isolation","Isolation des données","security","read",[],["tenant","isolation"]],
["security-write-gate","Contrôle avant écriture","security","critical",["create_recommendation","save_financial_insight"],["write","approval"]],
["security-ssrf-defense","Défense SSRF","security","read",WEB,["ssrf","network"]],
["security-sensitive-data","Détection de données sensibles","security","read",[],["pii","secrets"]],
["voice-response","Réponse vocale","voice","read",[],["tts","voice"]],
["voice-provider-fallback","Fallback vocal","voice","read",[],["hume","elevenlabs"]],
];

export const NEXORA_SKILLS: readonly NexoraSkill[] = SKILL_DATA.map(([id,name,category,risk,tools,tags])=>({
  id,version:"1.1.0",name,description:name,category,risk,tools,enabled:true,
  requiresHumanApproval:risk === "write" || risk === "critical",tags,
}));

export function listNexoraSkills(options?:{category?:SkillCategory;enabledOnly?:boolean;tag?:string}){
  return NEXORA_SKILLS.filter(s=>(!options?.category||s.category===options.category)&&(!options?.enabledOnly||s.enabled)&&(!options?.tag||s.tags.includes(options.tag)));
}
export function getNexoraSkill(id:string){return NEXORA_SKILLS.find(s=>s.id===id);}
export function skillPrompt(){return listNexoraSkills({enabledOnly:true}).map(s=>`- ${s.id} v${s.version}: ${s.description} [cat=${s.category}; risque=${s.risk}; outils=${s.tools.join(",")||"aucun"}]`).join("\n");}
