export type LiaSpecialistAgent = {
  id: string;
  label: string;
  purpose: string;
  skills: string[];
  autonomous: boolean;
};

export const LIA_SPECIALIST_AGENTS: LiaSpecialistAgent[] = [
  { id: "copywriting", label: "Copywriting", purpose: "Rédiger et améliorer les contenus Nexora sans publication implicite.", skills: ["content-generation", "ux-copy", "email-copy"], autonomous: true },
  { id: "seo", label: "SEO", purpose: "Auditer et améliorer le référencement technique et éditorial.", skills: ["technical-seo", "keyword-analysis", "metadata"], autonomous: true },
  { id: "system-admin", label: "System Admin", purpose: "Surveiller la santé technique, diagnostiquer et proposer des corrections bornées.", skills: ["system-health", "system-diagnostics", "build-analysis"], autonomous: true },
  { id: "data", label: "Data Manager", purpose: "Contrôler la qualité, cohérence, déduplication et analyse des données.", skills: ["data-quality", "data-deduplication", "anomaly-detection"], autonomous: true },
  { id: "finance", label: "Finance", purpose: "Analyser budget, transactions, objectifs et pilotage financier.", skills: ["finance-analytics", "financial-reasoning", "goal-lifecycle"], autonomous: true },
  { id: "mobility", label: "Mobility", purpose: "Calculer les coûts de mobilité, carburant, trajets et véhicules.", skills: ["mobility-fuel", "mobility-profile"], autonomous: true },
  { id: "research", label: "Research", purpose: "Rechercher et synthétiser des sources avec gouvernance Tavily.", skills: ["tavily-search", "tavily-research", "source-trust"], autonomous: true },
];
