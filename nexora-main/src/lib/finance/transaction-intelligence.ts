export type FinancialFact = {
  id: string;
  label: string;
  amount: number;
  occurredAt: string;
  category?: string | null;
  source: "bank" | "manual";
};

export type RecurringCandidate = {
  key: string;
  label: string;
  amount: number;
  cadence: "weekly" | "monthly" | "quarterly" | "irregular";
  occurrences: number;
  confidence: number;
  nextExpectedDate: string | null;
};

export type AnomalyCandidate = {
  id: string;
  label: string;
  amount: number;
  category: string;
  baseline: number;
  ratio: number;
  confidence: number;
  occurredAt: string;
};

const normalize = (value: string) => value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const daysBetween = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
const cadenceFrom = (avg: number): RecurringCandidate["cadence"] => avg <= 10 ? "weekly" : avg <= 45 ? "monthly" : avg <= 120 ? "quarterly" : "irregular";
const addDays = (iso: string, days: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + Math.round(days)); return d.toISOString().slice(0, 10); };

export function deriveTransactionIntelligence(facts: FinancialFact[]): { recurring: RecurringCandidate[]; anomalies: AnomalyCandidate[] } {
  const expenses = facts.filter((x) => x.amount < 0).map((x) => ({ ...x, amount: Math.abs(x.amount) })).filter((x) => Number.isFinite(x.amount) && x.amount > 0);
  const groups = new Map<string, FinancialFact[]>();
  for (const fact of expenses) {
    const label = normalize(fact.label);
    if (!label) continue;
    const bucket = Math.round(fact.amount / Math.max(5, fact.amount * 0.03));
    const key = `${label}|${bucket}`;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  const recurring: RecurringCandidate[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < 3) continue;
    const ordered = [...rows].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const intervals = ordered.slice(1).map((row, i) => daysBetween(ordered[i].occurredAt, row.occurredAt)).filter(Number.isFinite);
    if (intervals.length < 2) continue;
    const avg = intervals.reduce((s, x) => s + x, 0) / intervals.length;
    const spread = Math.max(...intervals) - Math.min(...intervals);
    const cadence = cadenceFrom(avg);
    const regularity = Math.max(0, 1 - spread / Math.max(avg * 2, 1));
    const confidence = Math.min(0.99, 0.45 + Math.min(0.3, rows.length * 0.06) + regularity * 0.25);
    const last = ordered.at(-1)!;
    recurring.push({ key, label: last.label, amount: median(ordered.map((x) => Math.abs(x.amount))), cadence, occurrences: rows.length, confidence: Number(confidence.toFixed(2)), nextExpectedDate: cadence === "irregular" ? null : addDays(last.occurredAt, avg) });
  }

  const categoryValues = new Map<string, number[]>();
  for (const row of expenses) {
    const category = row.category?.trim() || "Non catégorisé";
    categoryValues.set(category, [...(categoryValues.get(category) ?? []), row.amount]);
  }
  const anomalies: AnomalyCandidate[] = [];
  for (const row of expenses) {
    const category = row.category?.trim() || "Non catégorisé";
    const baseline = median(categoryValues.get(category) ?? []);
    if (baseline <= 0 || row.amount < 3 * baseline || row.amount < 100) continue;
    const ratio = row.amount / baseline;
    const confidence = Math.min(0.98, 0.55 + Math.min(0.4, (ratio - 3) * 0.08));
    anomalies.push({ id: row.id, label: row.label, amount: row.amount, category, baseline: Number(baseline.toFixed(2)), ratio: Number(ratio.toFixed(2)), confidence: Number(confidence.toFixed(2)), occurredAt: row.occurredAt });
  }
  anomalies.sort((a, b) => b.ratio - a.ratio);
  recurring.sort((a, b) => b.confidence - a.confidence);
  return { recurring: recurring.slice(0, 12), anomalies: anomalies.slice(0, 12) };
}
