export type NexoraPageContext = {
  path: string;
  page: string;
  section: string;
  visibleContext?: string;
};

const PAGE_MAP: Array<[string, string, string]> = [
  ["/dashboard", "Tableau de bord", "vue globale des finances"],
  ["/budget", "Budget", "budgets, enveloppes et écarts"],
  ["/transactions", "Transactions", "dépenses, revenus et mouvements"],
  ["/banque", "Comptes", "comptes bancaires et liquidités"],
  ["/patrimoine", "Patrimoine", "patrimoine et évolution nette"],
  ["/previsions", "Prévisions", "prévisions et trajectoire financière"],
  ["/pilotage", "Pilotage", "indicateurs et pilotage financier"],
  ["/orchestration", "Orchestration IA", "agents, objectifs et automatisation"],
  ["/use-cases", "IA & Use Cases", "cas d'usage et apprentissage"],
  ["/runtime", "Runtime LIA", "exécution et gouvernance de l'IA"],
  ["/veille", "Veille", "veille et connaissances"],
];

export function getNexoraPageContext(path: string): NexoraPageContext {
  const clean = path.split("?")[0] || "/";
  const match = PAGE_MAP.find(([prefix]) => clean === prefix || clean.startsWith(`${prefix}/`));
  return match
    ? { path: clean.slice(0, 300), page: match[1], section: match[2] }
    : { path: clean.slice(0, 300), page: "Nexora", section: "application" };
}

export function buildCopilotObjective(ctx: NexoraPageContext, userMessage?: string) {
  if (userMessage) {
    return `L'utilisateur est actuellement sur ${ctx.page} (${ctx.section}). Réponds à sa demande en utilisant les données financières autorisées et vérifie les faits avant de conclure. Demande utilisateur: ${userMessage}`;
  }
  return `L'utilisateur vient d'arriver sur la page ${ctx.page}, consacrée à ${ctx.section}. Fais une vérification courte et utile de sa situation financière liée à cette page. Ne cherche pas à tout analyser: détecte uniquement un signal réellement pertinent (anomalie, risque, économie possible, échéance, dépassement, opportunité ou incohérence). Si aucun signal solide n'est détecté, réponds exactement "NO_PROACTIVE_SIGNAL". Ne fais aucune action financière d'écriture et ne demande jamais de secret.`;
}
