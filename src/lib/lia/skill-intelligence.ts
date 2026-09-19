export type LiaSkillIntelligenceLayer = "infrastructure" | "finance" | "research" | "evolution";
export type LiaSkillBlueprintRisk = "read" | "write" | "critical";

export type LiaSkillBlueprint = {
  slug: string;
  name: string;
  layer: LiaSkillIntelligenceLayer;
  description: string;
  riskClass: LiaSkillBlueprintRisk;
  activationPolicy: "knowledge_blueprint_only";
  sourceRefs: string[];
  requiredVerification?: string[];
};

export const LIA_SKILL_INTELLIGENCE: readonly LiaSkillBlueprint[] = [
  {
    slug: "skill-router",
    name: "Sélection des Skills",
    layer: "infrastructure",
    description: "Sélectionner les Skills pertinentes avant exécution.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "context-manager",
    name: "Construction du contexte",
    layer: "infrastructure",
    description: "Construire le contexte minimal : intention, finance, mémoire, knowledge, Skills, outils, policies.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "memory-manager",
    name: "Gestion mémoire",
    layer: "infrastructure",
    description: "Récupérer, consolider, vérifier et maintenir les mémoires pertinentes.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "knowledge-manager",
    name: "Gestion des connaissances",
    layer: "infrastructure",
    description: "Structurer, valider, versionner et récupérer les connaissances.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "skill-evaluator",
    name: "Évaluation des Skills",
    layer: "infrastructure",
    description: "Mesurer succès, exactitude, régressions, sécurité et conformité d'une Skill.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "skill-versioning",
    name: "Versioning des Skills",
    layer: "infrastructure",
    description: "Gérer versions, états, rollback et traçabilité des Skills.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "autonomy-controller",
    name: "Contrôle d'autonomie",
    layer: "infrastructure",
    description: "Appliquer les budgets de tokens, temps, outils, mémoire, risque et actions.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "permission-guard",
    name: "Garde des permissions",
    layer: "infrastructure",
    description: "Vérifier indépendamment du modèle les permissions et scopes avant chaque opération.",
    riskClass: "critical",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "audit-trail",
    name: "Traçabilité",
    layer: "infrastructure",
    description: "Tracer tâche, Skill, version, outils, mémoire, résultat, évaluateur et feedback.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "transaction-analyzer",
    name: "Analyse des transactions",
    layer: "finance",
    description: "Normaliser et analyser les transactions observées sans inventer de données.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "transaction-categorizer",
    name: "Catégorisation des transactions",
    layer: "finance",
    description: "Catégoriser les transactions avec règles et incertitudes explicites.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "budget-analyzer",
    name: "Analyse budgétaire",
    layer: "finance",
    description: "Comparer budget, réalisé et trajectoire financière.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "anomaly-detector",
    name: "Détection d'anomalies",
    layer: "finance",
    description: "Détecter les comportements inhabituels avec contexte et preuves.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "forecast-engine",
    name: "Moteur de prévision",
    layer: "finance",
    description: "Produire des prévisions séparant observations, hypothèses et incertitudes.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "cashflow-analyzer",
    name: "Analyse des flux",
    layer: "finance",
    description: "Analyser entrées, sorties et trajectoires de trésorerie.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "recommendation-engine",
    name: "Moteur de recommandations",
    layer: "finance",
    description: "Produire des recommandations contextualisées, explicables et soumises à décision humaine.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "financial-reasoning",
    name: "Raisonnement financier",
    layer: "finance",
    description: "Appliquer un raisonnement financier structuré et vérifiable.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "research-agent",
    name: "Agent de recherche",
    layer: "research",
    description: "Rechercher des informations documentaires avec sources et contexte de collecte.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "source-verifier",
    name: "Vérification des sources",
    layer: "research",
    description: "Vérifier qualité, provenance, date et statut de preuve des sources.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "security-watch",
    name: "Veille sécurité",
    layer: "research",
    description: "Surveiller les changements pertinents de sécurité à partir de sources fiables.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "compliance-watch",
    name: "Veille conformité",
    layer: "research",
    description: "Surveiller les changements réglementaires et produire des candidats de mise à jour.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "skill-feedback",
    name: "Feedback des Skills",
    layer: "evolution",
    description: "Transformer les corrections et observations en signaux d'amélioration.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "skill-improver",
    name: "Amélioration des Skills",
    layer: "evolution",
    description: "Proposer des évolutions versionnées sans activation automatique.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "skill-challenger",
    name: "Challenge des Skills",
    layer: "evolution",
    description: "Générer des cas difficiles, analyser les échecs et rejouer les tests.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "memory-to-skill",
    name: "Mémoire vers Skill",
    layer: "evolution",
    description: "Détecter des comportements procéduraux récurrents justifiant une Skill candidate.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  },
  {
    slug: "knowledge-consolidator",
    name: "Consolidation du savoir",
    layer: "evolution",
    description: "Fusionner les connaissances compatibles après validation et déduplication.",
    riskClass: "read",
    activationPolicy: "knowledge_blueprint_only",
    sourceRefs: [
      "Knowledge_Skills_Cerveau_IA_v1/08_SKILLS_FINANCE_PRIORITAIRES.md",
      "Knowledge_Skills_Cerveau_IA_v1/02_SKILL_STANDARD.md"
    ],
    requiredVerification: [
      "inputs_validated",
      "policy_checked",
      "result_verified"
    ]
  }
] as const;

const LAYER_KEYWORDS: Record<LiaSkillIntelligenceLayer, string[]> = {
  infrastructure: ["skill", "compétence", "contexte", "mémoire", "knowledge", "permission", "autorisation", "audit", "autonomie", "version"],
  finance: ["transaction", "budget", "dépense", "revenu", "cashflow", "trésorerie", "prévision", "anomalie", "recommandation", "finance", "crédit"],
  research: ["recherche", "source", "veille", "sécurité", "conformité", "réglement", "actualité", "document"],
  evolution: ["améliorer", "apprendre", "feedback", "erreur", "test", "régression", "challenge", "nouvelle skill", "consolider"],
};

const SKILL_KEYWORDS: Record<string, string[]> = {
  "transaction-analyzer": ["transaction", "opération", "paiement"],
  "transaction-categorizer": ["catégor", "classification", "restaurant", "carrefour", "dépense"],
  "budget-analyzer": ["budget", "enveloppe", "prévu", "réalisé"],
  "forecast-engine": ["prévision", "projection", "futur"],
  "cashflow-analyzer": ["trésorerie", "cashflow", "flux"],
  "anomaly-detector": ["anomalie", "inhabituel", "bizarre"],
  "financial-reasoning": ["analyse financière", "raisonnement financier", "crédit"],
  "recommendation-engine": ["recommandation", "conseil", "priorité"],
  "research-agent": ["recherche", "cherche", "apprends", "documente"],
  "source-verifier": ["source", "vérifie", "preuve"],
  "security-watch": ["sécurité", "vulnérabilité", "cyber"],
  "compliance-watch": ["conformité", "réglement", "loi", "directive"],
  "skill-evaluator": ["évalue la skill", "évaluation", "performance"],
  "skill-challenger": ["challenge", "cas difficile", "edge case", "régression"],
  "skill-improver": ["améliore la skill", "amélioration", "corrige la skill"],
  "memory-manager": ["mémoire", "souvenir"],
  "knowledge-manager": ["connaissance", "knowledge"],
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function getSkillIntelligenceBlueprint(slug: string): LiaSkillBlueprint | null {
  return LIA_SKILL_INTELLIGENCE.find((skill) => skill.slug === slug) ?? null;
}

export function recommendSkillBlueprints(query: string, limit = 8): LiaSkillBlueprint[] {
  const q = normalize(query);
  const scored = LIA_SKILL_INTELLIGENCE.map((skill) => {
    const keywords = (SKILL_KEYWORDS[skill.slug] ?? []).map(normalize);
    const layerKeywords = LAYER_KEYWORDS[skill.layer].map(normalize);
    const haystack = normalize(`${skill.name} ${skill.description}`);
    let score = 0;
    for (const keyword of keywords) if (q.includes(keyword)) score += 5;
    for (const keyword of layerKeywords) if (q.includes(keyword)) score += 1;
    if (haystack.includes(q) && q.length > 2) score += 2;
    return { skill, score };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.slug.localeCompare(b.skill.slug));
  return scored.slice(0, Math.max(1, Math.min(limit, 20))).map((item) => item.skill);
}

export function skillIntelligenceInvariants() {
  return {
    blueprintCount: LIA_SKILL_INTELLIGENCE.length,
    layers: [...new Set(LIA_SKILL_INTELLIGENCE.map((skill) => skill.layer))],
    allBlueprintsNonActivating: LIA_SKILL_INTELLIGENCE.every((skill) => skill.activationPolicy === "knowledge_blueprint_only"),
    allHaveProvenance: LIA_SKILL_INTELLIGENCE.every((skill) => skill.sourceRefs.length > 0),
    permissionSeparated: true,
  } as const;
}


export type LiaSkillRegistryObservation = {
  skillId: string;
  slug: string;
  name: string;
  category: string;
  status: "validated" | "active";
  trustScore: number;
  version: number;
};

export function buildSkillIntelligenceContext(
  query: string,
  registeredSkills: LiaSkillRegistryObservation[] = [],
) {
  const blueprints = recommendSkillBlueprints(query, 8);
  const selected = blueprints.map((blueprint) => {
    const registered = registeredSkills.find((skill) => skill.slug === blueprint.slug) ?? null;
    return {
      slug: blueprint.slug,
      name: blueprint.name,
      layer: blueprint.layer,
      riskClass: blueprint.riskClass,
      activationPolicy: blueprint.activationPolicy,
      sourceRefs: blueprint.sourceRefs,
      requiredVerification: blueprint.requiredVerification ?? [],
      registry: registered
        ? {
            skillId: registered.skillId,
            status: registered.status,
            trustScore: registered.trustScore,
            version: registered.version,
            category: registered.category,
          }
        : null,
    };
  });

  return {
    selected,
    eligibleForAutonomousRead: selected.filter(
      (skill) =>
        skill.riskClass === "read" &&
        skill.registry !== null &&
        skill.registry.status === "active" &&
        skill.registry.trustScore >= 70,
    ).map((skill) => skill.slug),
    candidateOnly: selected.filter(
      (skill) =>
        !skill.registry ||
        skill.registry.status !== "active" ||
        skill.riskClass !== "read",
    ).map((skill) => skill.slug),
    activation: {
      modelMayRecommend: true,
      modelMayCreateCandidate: true,
      modelMayValidate: false,
      modelMayActivate: false,
      humanGateRequired: true,
      exactVersionRequiredForActiveSkill: true,
    },
    invariants: skillIntelligenceInvariants(),
  } as const;
}
