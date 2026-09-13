import type { AutopilotObservation, AutopilotOpportunity, BudgetEnvelope, FixedExpenseForAutopilot, TransactionForAutopilot } from "./types";

const normalize = (s: string) => s.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const euro = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
const median = (xs: number[]) => { const a = [...xs].sort((x,y)=>x-y); if (!a.length) return 0; const m=Math.floor(a.length/2); return a.length%2 ? a[m] : (a[m-1]+a[m])/2; };

const envelopeAliases: Record<string, string[]> = {
  alimentation: ["alimentation", "courses", "supermarche", "carrefour", "auchan", "leclerc", "intermarche", "lidl", "aldi"],
  logement: ["logement", "loyer", "habitation"],
  transport: ["transport", "essence", "carburant", "peage", "sncf", "ratp", "uber"],
  loisirs: ["loisirs", "cinema", "restaurant", "sortie", "steam", "playstation"],
  abonnements: ["abonnement", "netflix", "spotify", "prime", "canal", "adobe", "icloud"],
  sante: ["sante", "pharmacie", "medecin", "mutuelle"],
  energie: ["energie", "edf", "engie", "electricite", "gaz"],
};

export function inferEnvelope(label: string, envelopes: BudgetEnvelope[]) {
  const text = normalize(label);
  let best: { key: string; confidence: number } | null = null;
  for (const env of envelopes) {
    const key = normalize(env.id || String(env.name || ""));
    const name = normalize(String(env.name || ""));
    const aliases = [...(envelopeAliases[key] ?? []), key, name].filter(Boolean);
    const score = aliases.some(alias => text.includes(alias) || alias.includes(text)) ? 0.94 : 0;
    if (score && (!best || score > best.confidence)) best = { key: env.id, confidence: score };
  }
  return best;
}

export function observeTransactions(transactions: TransactionForAutopilot[], envelopes: BudgetEnvelope[], now = new Date()): AutopilotObservation[] {
  const observations: AutopilotObservation[] = [];
  const expenses = transactions.filter(t => t.amount < 0).map(t => ({ ...t, amount: Math.abs(t.amount) }));
  const groups = new Map<string, number[]>();
  for (const t of expenses) { const k = normalize(t.label); groups.set(k, [...(groups.get(k) ?? []), t.amount]); }
  for (const t of expenses.slice(0, 100)) {
    const inferred = inferEnvelope(t.label, envelopes);
    if (inferred && !t.category_id) observations.push({ key: `classify:${t.id}`, type: "transaction_classification", severity: "info", title: "Transaction classifiable automatiquement", message: `${t.label} peut être affectée à l’enveloppe « ${inferred.key} » avec ${Math.round(inferred.confidence*100)} % de confiance.`, confidence: inferred.confidence, actionHref: "/transactions", evidence: { transaction_id: t.id, envelope_key: inferred.key, amount: t.amount, auto_apply_eligible: inferred.confidence >= 0.9 } });
    const history = groups.get(normalize(t.label)) ?? [];
    const base = median(history.filter(v => v !== t.amount));
    const age = now.getTime() - new Date(t.occurred_at).getTime();
    if (base >= 20 && age <= 14 * 86400000 && t.amount >= Math.max(base * 1.75, base + 40)) observations.push({ key: `anomaly:${t.id}`, type: "transaction_classification", severity: t.amount >= base * 2.5 ? "danger" : "warning", title: "Dépense inhabituelle détectée", message: `${t.label} est à ${euro(t.amount)}, contre environ ${euro(base)} habituellement.`, confidence: 0.93, actionHref: "/transactions", evidence: { transaction_id: t.id, amount: t.amount, baseline: base } });
  }
  return observations.slice(0, 30);
}

export function observeBudget(envelopes: BudgetEnvelope[]): AutopilotOpportunity[] {
  const out: AutopilotOpportunity[] = [];
  for (const e of envelopes) {
    const planned = Math.max(Number(e.planned ?? 0), 0);
    const spent = Math.max(Number(e.spent ?? e.manual_spent ?? 0), 0);
    if (planned > 0 && spent > planned) {
      out.push({ key: `budget-over:${e.id}`, type: "budget_drift", severity: "warning", title: `Budget « ${String(e.name ?? e.id)} » dépassé`, message: `L'enveloppe a consommé ${euro(spent)} pour ${euro(planned)} prévus.`, estimatedImpact: spent - planned, confidence: 0.99, reversible: true, requiresHumanApproval: false, evidence: { envelope_key: e.id, planned, spent } });
    } else if (planned > 0 && spent / planned >= 0.85) {
      out.push({ key: `budget-near:${e.id}`, type: "budget_drift", severity: "warning", title: `Budget « ${String(e.name ?? e.id)} » bientôt atteint`, message: `${Math.round((spent/planned)*100)} % de l'enveloppe est déjà consommé.`, estimatedImpact: planned - spent, confidence: 0.99, reversible: true, requiresHumanApproval: false, evidence: { envelope_key: e.id, planned, spent } });
    }
  }
  return out;
}

export function predictRecurringExpenses(fixed: FixedExpenseForAutopilot[], now = new Date()) {
  const predictions = fixed.filter(e => e.is_active && e.recurrence === "monthly").map(e => {
    const day = Math.min(Math.max(Number(e.due_day ?? 1), 1), 28);
    const year = now.getUTCFullYear(); const month = now.getUTCMonth();
    let date = new Date(Date.UTC(year, month, day));
    if (date <= now) date = new Date(Date.UTC(year, month + 1, day));
    return { fixedExpenseId: e.id, label: e.label, amount: e.amount, dueDate: date.toISOString().slice(0,10), sector: e.sector };
  });
  return predictions;
}

export function observeRecurring(fixed: FixedExpenseForAutopilot[], now = new Date()): AutopilotObservation[] {
  return predictRecurringExpenses(fixed, now).slice(0, 50).map(p => ({ key: `recurring:${p.fixedExpenseId}:${p.dueDate}`, type: "recurring", severity: "info", title: "Dépense récurrente anticipée", message: `${p.label} de ${euro(p.amount)} est attendu autour du ${new Intl.DateTimeFormat("fr-FR").format(new Date(`${p.dueDate}T00:00:00Z`))}.`, confidence: 0.97, actionHref: "/previsions", evidence: p }));
}

export function findOpportunities(fixed: FixedExpenseForAutopilot[], transactions: TransactionForAutopilot[], balance: number, reserve: number, now = new Date()): AutopilotOpportunity[] {
  const out: AutopilotOpportunity[] = [];
  const recurring = fixed.filter(e => e.is_active && e.recurrence === "monthly");
  for (const e of recurring) {
    const text = normalize(`${e.label} ${e.sector}`);
    if (/(assurance|internet|telephone|mobile|mutuelle|energie|electricite|gaz)/.test(text)) {
      const days = Math.ceil((new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(Number(e.due_day ?? 1), 28))).getTime() - now.getTime()) / 86400000);
      out.push({ key: `contract:${e.id}`, type: "contract_review", severity: days >= 0 && days <= 60 ? "warning" : "info", title: `Contrat à surveiller : ${e.label}`, message: `${e.label} coûte ${euro(e.amount)} par mois. LIA recommande une comparaison ou renégociation avant l'échéance détectée.`, estimatedImpact: e.amount * 0.15 * 12, confidence: 0.72, reversible: true, requiresHumanApproval: true, evidence: { fixed_expense_id: e.id, due_day: e.due_day, monthly_amount: e.amount, review_window_days: 60 } });
    }
  }
  const monthlyExpenses = transactions.filter(t => t.amount < 0 && new Date(t.occurred_at).getTime() >= now.getTime() - 30*86400000).reduce((s,t)=>s+Math.abs(t.amount),0);
  if (reserve > 0 && balance < reserve) out.push({ key: "cashflow:reserve", type: "cashflow_risk", severity: "danger", title: "Risque de trésorerie", message: `Le solde actuel de ${euro(balance)} est sous la réserve de sécurité de ${euro(reserve)}.`, estimatedImpact: reserve - balance, confidence: 0.99, reversible: true, requiresHumanApproval: false, evidence: { balance, reserve, monthlyExpenses } });
  return out.slice(0, 20);
}
