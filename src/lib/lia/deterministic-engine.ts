export type DeterministicAnalysis = {
  content: string;
  model: "lia-cognitive-core";
  provider: "deterministic";
  confidence: number;
  capabilities: string[];
};

type Tx = {
  id?: string;
  amount?: number | string;
  occurred_at?: string;
  label?: string;
  category_id?: string | null;
  categories?: { name?: string } | Array<{ name?: string }> | null;
};

type Envelope = { name?: string; planned?: number | string; spent?: number | string; manual_spent?: number | string };
type FixedExpense = { label?: string; sector?: string; amount?: number | string; due_day?: number | string; recurrence?: string };
type Goal = { name?: string; target_amount?: number | string; current_amount?: number | string; target_date?: string; priority?: number | string };

type Context = Record<string, unknown> & {
  summary?: { account_balance_total?: number; income_90d?: number; expenses_90d?: number; transaction_count?: number };
  accounts?: Array<{ name?: string; balance?: number | string; currency?: string; kind?: string }>;
  transactions?: Tx[];
  goals?: Goal[];
  forecasts?: Array<{ horizon?: string; projected_balance?: number | string; confidence?: number | string }>;
  relational?: {
    relationship_mode?: string;
    preferred_tone?: string;
    detail_level?: string;
    initiative_level?: number;
    financial_coaching_style?: string;
    goal_context?: string | null;
    consented_personalization?: boolean;
  };
  budget_planning?: { month?: string; scenario?: { income?: number | string; starting_balance?: number | string; safety_reserve?: number | string; extra_expense?: number | string; weeks_remaining?: number | string; envelopes?: Envelope[] } | null; fixed_expenses?: FixedExpense[] };
};

const n = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pct = (value: number) => `${Math.round(value)} %`;
const monthLabel = (key: string) => {
  const date = new Date(`${key.slice(0, 7)}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? key : date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

function categoryName(tx: Tx) {
  const relation = tx.categories;
  if (Array.isArray(relation)) return relation[0]?.name || "Sans catégorie";
  return relation?.name || "Sans catégorie";
}

function currentMonthTransactions(transactions: Tx[], monthKey: string) {
  return transactions.filter((tx) => String(tx.occurred_at || "").slice(0, 7) === monthKey.slice(0, 7));
}

function budgetSnapshot(context: Context) {
  const month = String(context.budget_planning?.month || new Date().toISOString().slice(0, 7) + "-01");
  const scenario = context.budget_planning?.scenario;
  const envelopes = Array.isArray(scenario?.envelopes) ? scenario.envelopes : [];
  const fixed = Array.isArray(context.budget_planning?.fixed_expenses) ? context.budget_planning.fixed_expenses : [];
  const transactions = Array.isArray(context.transactions) ? context.transactions : [];
  const monthTx = currentMonthTransactions(transactions, month);
  const observedIncome = monthTx.filter((t) => n(t.amount) > 0).reduce((s, t) => s + n(t.amount), 0);
  const observedExpenses = monthTx.filter((t) => n(t.amount) < 0).reduce((s, t) => s + Math.abs(n(t.amount)), 0);
  const plannedIncome = n(scenario?.income);
  const fixedTotal = fixed.reduce((s, x) => s + Math.max(0, n(x.amount)), 0);
  const plannedEnvelopeTotal = envelopes.reduce((s, x) => s + Math.max(0, n(x.planned)), 0);
  const envelopeSpent = envelopes.reduce((s, x) => s + Math.max(0, n(x.spent) + n(x.manual_spent)), 0);
  const starting = n(scenario?.starting_balance);
  const reserve = n(scenario?.safety_reserve);
  const extra = n(scenario?.extra_expense);
  const projected = starting + (plannedIncome || observedIncome) - fixedTotal - plannedEnvelopeTotal - extra;
  return { month, scenario, envelopes, fixed, monthTx, observedIncome, observedExpenses, plannedIncome, fixedTotal, plannedEnvelopeTotal, envelopeSpent, starting, reserve, extra, projected };
}

function topExpenses(transactions: Tx[]) {
  const groups = new Map<string, number>();
  for (const tx of transactions) {
    const amount = n(tx.amount);
    if (amount >= 0) continue;
    const key = categoryName(tx);
    groups.set(key, (groups.get(key) || 0) + Math.abs(amount));
  }
  return [...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function anomalies(transactions: Tx[]) {
  const expenses = transactions.filter((t) => n(t.amount) < 0).map((t) => ({ ...t, value: Math.abs(n(t.amount)) }));
  if (!expenses.length) return [] as Array<{ label: string; value: number }>;
  const average = expenses.reduce((s, x) => s + x.value, 0) / expenses.length;
  return expenses
    .filter((x) => x.value >= Math.max(100, average * 2.5))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((x) => ({ label: x.label || "Dépense", value: x.value }));
}

export function deterministicLiaAnalysis(question: string, context: Context, task = "financial_analysis", research?: { claims?: unknown[]; evidence?: unknown[]; contradictions?: unknown[]; minimumEvidenceMet?: boolean } | null): DeterministicAnalysis {
  const q = question.toLowerCase();
  const summary = context.summary || {};
  const transactions = Array.isArray(context.transactions) ? context.transactions : [];
  const accounts = Array.isArray(context.accounts) ? context.accounts : [];
  const goals = Array.isArray(context.goals) ? context.goals : [];
  const forecasts = Array.isArray(context.forecasts) ? context.forecasts : [];
  const budget = budgetSnapshot(context);
  const capabilities = ["analyse du budget", "lecture des transactions", "suivi des comptes", "prévisions", "objectifs", "détection de dérives", "explication des données"];
  const relational = context.relational?.consented_personalization === true ? context.relational : null;
  const detailLevel = relational?.detail_level ?? "balanced";
  const initiativeLevel = Number(relational?.initiative_level ?? 1);
  const coachingStyle = relational?.financial_coaching_style ?? "balanced";
  const preferredTone = relational?.preferred_tone ?? "neutral";

  const balance = n(summary.account_balance_total) || accounts.reduce((s, a) => s + n(a.balance), 0);
  const income90 = n(summary.income_90d);
  const expenses90 = n(summary.expenses_90d);
  const savings90 = income90 - expenses90;
  const top = topExpenses(transactions);
  const odd = anomalies(transactions);

  const lines: string[] = [];
  const isGreeting = /^(bonjour|bonsoir|salut|hello|coucou|hey)\b[ !,.]*$/i.test(question.trim());
  if (isGreeting) {
    return {
      content: "Bonjour 👋 Je suis LIA. Je peux t’aider à comprendre tes finances, suivre ton budget, analyser tes dépenses, regarder tes prévisions et suivre tes objectifs.\n\nDis-moi simplement ce que tu veux savoir ou vérifier.",
      model: "lia-cognitive-core",
      provider: "deterministic",
      confidence: 100,
      capabilities,
    };
  }
  if (relational) {
    const toneIntro = preferredTone === "warm"
      ? "Je vais te répondre de façon claire et personnalisée, en gardant une approche concrète."
      : preferredTone === "encouraging"
        ? "On va regarder les faits ensemble et dégager les actions les plus utiles."
        : preferredTone === "direct"
          ? "Voici l'essentiel, directement à partir de tes données."
          : "Voici l'analyse basée sur les données disponibles.";
    lines.push(toneIntro);
    if (coachingStyle === "protective") lines.push("Je privilégie ici la sécurité et la préservation de ta marge de manœuvre.");
    if (coachingStyle === "growth") lines.push("Je privilégie ici les leviers qui peuvent améliorer progressivement ta situation.");
  }

  const asksBudget = /budget|enveloppe|dépense mensuelle|dépenses du mois|mois|reste à vivre|charges fixes/.test(q) || task === "budget";
  const asksBalance = /solde|compte|combien.*argent|trésorerie|cashflow|liquidité/.test(q) || task === "cashflow";
  const asksTransactions = /transaction|dépense|revenu|achat|sortie|entrée/.test(q);
  const asksGoal = /objectif|épargne|économi|projet/.test(q) || task === "wealth";
  const asksForecast = /prévision|projection|avenir|prochain mois|prochains mois|futur/.test(q);
  const asksAnomaly = /anomal|inhabitu|dérive|excess|trop dépens/.test(q);
  const asksSpendingDistribution = /(où|ou)\s+(part|va)\s+(mon|mes|l['’]?)?\s*(argent|dépenses?|revenus?)/.test(q)
    || /dans quoi.*(dépense|argent)|répartition.*(dépense|argent)|ou.*je.*dépense|je dépense où/.test(q);

  if (asksBudget) {
    lines.push(`**Budget de ${monthLabel(budget.month)}**`);
    lines.push(`- Solde des comptes : **${money(balance)}**`);
    lines.push(`- Revenus observés ce mois : **${money(budget.observedIncome)}**${budget.plannedIncome ? ` · prévus : ${money(budget.plannedIncome)}` : ""}`);
    lines.push(`- Dépenses observées ce mois : **${money(budget.observedExpenses)}**`);
    lines.push(`- Charges fixes planifiées : **${money(budget.fixedTotal)}**`);
    lines.push(`- Enveloppes : **${money(budget.plannedEnvelopeTotal)}** prévues · **${money(budget.envelopeSpent)}** consommées`);
    lines.push(`- Projection planifiée : **${money(budget.projected)}** après charges, enveloppes et dépenses supplémentaires connues.`);
    if (budget.reserve > 0) lines.push(`- Réserve de sécurité : **${money(budget.reserve)}** · marge au-dessus de la réserve : **${money(budget.projected - budget.reserve)}**.`);
    if (budget.envelopes.length) {
      lines.push("");
      lines.push("**Enveloppes à surveiller**");
      for (const e of budget.envelopes.slice(0, 8)) {
        const planned = Math.max(0, n(e.planned));
        const spent = Math.max(0, n(e.spent) + n(e.manual_spent));
        const ratio = planned > 0 ? spent / planned * 100 : 0;
        lines.push(`- ${e.name || "Enveloppe"} : ${money(spent)} / ${money(planned)} (${pct(ratio)}) · reste ${money(Math.max(0, planned - spent))}`);
      }
    }
  }

  if (asksBalance && !asksBudget) {
    lines.push(`**Trésorerie actuelle : ${money(balance)}**.`);
    lines.push(`Sur 90 jours : ${money(income90)} de revenus observés contre ${money(expenses90)} de dépenses, soit un solde de flux de ${money(savings90)}.`);
    if (forecasts.length) {
      const f = forecasts[0];
      lines.push(`Dernière prévision disponible : ${money(n(f.projected_balance))} sur ${f.horizon || "l'horizon enregistré"} avec une confiance de ${pct(n(f.confidence))}.`);
    }
  }

  if (asksSpendingDistribution) {
    lines.push("**Où part ton argent ?**");
    if (top.length) {
      const total = top.reduce((sum, [, value]) => sum + value, 0);
      lines.push(`Sur la période analysée, les dépenses se concentrent surtout sur **${money(total)}** répartis entre ces principaux postes :`);
      top.slice(0, 4).forEach(([name, value]) => {
        const share = expense90 > 0 ? value / expense90 * 100 : 0;
        lines.push(`- **${name}** : ${money(value)} (${pct(share)} des dépenses observées).`);
      });
      lines.push("Si tu veux, je peux ensuite te montrer **ce qui pèse le plus**, puis regarder avec toi où il y a réellement de la marge sans te priver inutilement.");
    } else {
      lines.push("Je n’ai pas encore assez de dépenses catégorisées pour te donner une répartition fiable. Je peux quand même regarder le détail des transactions disponibles.");
    }
  }

  if (asksTransactions && !asksBudget && !asksBalance && !asksSpendingDistribution) {
    lines.push(`**Activité récente : ${transactions.length} transaction(s) observée(s) sur la fenêtre analysée.**`);
    lines.push(`- Revenus 90 jours : **${money(income90)}**`);
    lines.push(`- Dépenses 90 jours : **${money(expenses90)}**`);
    if (top.length) {
      lines.push("");
      lines.push("**Principaux postes de dépense**");
      top.forEach(([name, value], i) => lines.push(`${i + 1}. ${name} : **${money(value)}**`));
    }
  }

  if (asksAnomaly || /question|analyse|fais le point|point complet|situation/.test(q)) {
    lines.push("");
    lines.push("**Points de vigilance**");
    if (odd.length) odd.forEach((x) => lines.push(`- ${x.label || "Dépense"} : **${money(x.value)}**, nettement au-dessus du niveau moyen des dépenses observées.`));
    else lines.push("- Aucune dépense ne dépasse le seuil déterministe de détection actuel (au moins 100 € et 2,5× la dépense moyenne de la fenêtre analysée).");
    if (budget.projected < 0) lines.push(`- ⚠️ La projection du mois est négative : **${money(budget.projected)}**.`);
    else if (budget.reserve > 0 && budget.projected < budget.reserve) lines.push(`- ⚠️ La projection passe sous la réserve de sécurité : **${money(budget.projected - budget.reserve)}** de marge.`);
  }

  if (asksGoal) {
    lines.push("");
    lines.push("**Objectifs**");
    if (goals.length) {
      goals.slice(0, 6).forEach((g) => {
        const target = n(g.target_amount);
        const current = n(g.current_amount);
        const progress = target > 0 ? current / target * 100 : 0;
        lines.push(`- ${g.name || "Objectif"} : ${money(current)} / ${money(target)} (${pct(progress)})${g.target_date ? ` · cible ${g.target_date}` : ""}`);
      });
    } else lines.push("- Aucun objectif financier enregistré.");
  }

  if (asksForecast) {
    lines.push("");
    lines.push("**Prévisions**");
    if (forecasts.length) forecasts.slice(0, 5).forEach((f) => lines.push(`- ${f.horizon || "Horizon"} : solde projeté ${money(n(f.projected_balance))} · confiance ${pct(n(f.confidence))}.`));
    else lines.push("- Aucune prévision enregistrée n'est disponible.");
  }

  if (!asksBudget && !asksBalance && !asksTransactions && !asksGoal && !asksForecast && !asksAnomaly) {
    lines.push("**Ce que je peux analyser maintenant**");
    lines.push("- ton budget et tes enveloppes ;");
    lines.push("- tes revenus, dépenses et comptes ;");
    lines.push("- ta trésorerie et tes prévisions ;");
    lines.push("- tes objectifs d'épargne ;");
    lines.push("- les dérives ou dépenses inhabituelles.");
    lines.push("");
    lines.push("Pose-moi directement une question financière : je travaillerai d'abord sur les données enregistrées et les preuves disponibles.");
  }

  if (research?.minimumEvidenceMet && Array.isArray(research.evidence) && research.evidence.length) {
    lines.push("");
    lines.push(`**Recherche externe vérifiée : ${research.evidence.length} preuve(s) disponible(s).**`);
    lines.push("Je distingue ces informations externes des faits financiers enregistrés et je ne les utilise pas comme données personnelles.");
  }

  const simpleFinancialQuestion = asksSpendingDistribution && !/analyse|complet|situation|budget/.test(q);
  if (relational && initiativeLevel >= 2 && detailLevel !== "concise" && !simpleFinancialQuestion) {
    lines.push("");
    lines.push("**Accompagnement proposé**");
    lines.push(initiativeLevel >= 3
      ? "- Je peux te proposer les prochaines vérifications prioritaires dès que le contexte évolue."
      : "- Je te signale les prochaines vérifications utiles lorsque les données le justifient.");
  }

  if (!simpleFinancialQuestion) {
    lines.push("");
    lines.push("**Prochaine vérification** : contrôler les nouvelles transactions, l'état des enveloppes et la projection du mois avant toute décision financière.
  }

  const confidence = accounts.length || transactions.length || budget.envelopes.length ? 92 : 72;
  return { content: lines.join("\n"), model: "lia-cognitive-core", provider: "deterministic", confidence, capabilities };
}
