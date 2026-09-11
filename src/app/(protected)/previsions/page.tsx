"use client";

import { FinancialCrossDomainSummary } from "@/components/finance/financial-cross-domain-summary";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, TrendingDown, TrendingUp, BrainCircuit, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { UnifiedFinancialContext } from "@/lib/finance/unified-financial-context";

type Inputs = { starting_balance: number; expected_income: number; fixed_commitments: number; variable_budget: number; safety_reserve: number };
type Point = { label: string; central: number; favorable: number; unfavorable: number };
type Review = { id: string; period_start: string; expected_income: number; expected_expenses: number; actual_income: number; actual_expenses: number; planned_net: number; actual_net: number; variance: number; assessment: "pending" | "better_than_expected" | "on_track" | "worse_than_expected"; notes: string | null };
const money = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function monthLabel(date: Date) { return date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""); }
function project(inputs: Inputs, months: number, variableFactor = 1) {
  const result: number[] = [];
  let balance = inputs.starting_balance;
  for (let m = 0; m < months; m += 1) {
    balance += inputs.expected_income - inputs.fixed_commitments - inputs.variable_budget * variableFactor;
    result.push(Number(balance.toFixed(2)));
  }
  return result;
}

function ForecastChart({ points }: { points: Point[] }) {
  const all = points.flatMap((p) => [p.central, p.favorable, p.unfavorable]);
  const max = Math.max(...all, 1), min = Math.min(...all, 0), range = Math.max(max - min, 1);
  const x = (i: number) => 6 + i * (88 / Math.max(points.length - 1, 1));
  const y = (v: number) => 94 - ((v - min) / range) * 84;
  const line = (key: keyof Pick<Point, "central" | "favorable" | "unfavorable">) => points.map((p, i) => `${x(i)},${y(p[key])}`).join(" ");
  return <div className="overflow-x-auto"><svg viewBox="0 0 100 100" className="h-64 min-w-[620px] w-full" role="img" aria-label="Projection du solde sur six mois"><line x1="6" x2="94" y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity=".18" strokeDasharray="2 2"/><polyline fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.4" points={line("favorable")} /><polyline fill="none" stroke="currentColor" strokeWidth="2.2" points={line("central")} /><polyline fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.4" points={line("unfavorable")} />{points.map((p, i) => <g key={`${p.label || "forecast-point"}-${i}`}><circle cx={x(i)} cy={y(p.central)} r="1.7" fill="currentColor"/><text x={x(i)} y="99" textAnchor="middle" fontSize="3.2" fill="currentColor" opacity=".65">{p.label}</text></g>)}</svg></div>;
}

export default function Page() {
  const [inputs, setInputs] = useState<Inputs>({ starting_balance: 0, expected_income: 1730, fixed_commitments: 1275, variable_budget: 160, safety_reserve: 100 });
  const [actualBalance, setActualBalance] = useState<number | null>(null);
  const [actualIncome, setActualIncome] = useState(0);
  const [actualExpenses, setActualExpenses] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [financialContext, setFinancialContext] = useState<UnifiedFinancialContext | null>(null);
  const [saving, setSaving] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const load = async () => {
    const s = getSupabaseBrowserClient(); if (!s) return;
    const { data: { user } } = await s.auth.getUser(); if (!user) return;
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
    const period = monthStart.toISOString().slice(0, 10);
    const [forecast, contextResponse, reviewHistory] = await Promise.all([
      s.from("forecast_inputs").select("starting_balance,expected_income,fixed_commitments,variable_budget,safety_reserve,updated_at").eq("user_id", user.id).eq("period_start", period).maybeSingle(),
      fetch(`/api/finance/unified-context?month=${encodeURIComponent(period)}`, { cache: "no-store" }),
      s.from("forecast_reviews").select("id,period_start,expected_income,expected_expenses,actual_income,actual_expenses,planned_net,actual_net,variance,assessment,notes").eq("user_id", user.id).order("period_start", { ascending: false }).limit(6),
    ]);
    const context = contextResponse.ok ? await contextResponse.json() as UnifiedFinancialContext : null;
    setFinancialContext(context);
    if (forecast.data) { setInputs({ starting_balance: Number(forecast.data.starting_balance), expected_income: Number(forecast.data.expected_income), fixed_commitments: Number(forecast.data.fixed_commitments), variable_budget: Number(forecast.data.variable_budget), safety_reserve: Number(forecast.data.safety_reserve) }); setUpdated(forecast.data.updated_at); }
    if (context) {
      setActualBalance(Number(context.liquidity.primary_total ?? 0));
      setTransactionCount(Number(context.cashflow.transaction_count ?? 0));
      setActualIncome(Number(context.cashflow.income ?? 0));
      setActualExpenses(Number(context.cashflow.expenses ?? 0));
    }
    if (!reviewHistory.error) setReviews((reviewHistory.data ?? []) as Review[]);
    setLoading(false);
  };

  useEffect(() => { void load(); const s = getSupabaseBrowserClient(); if (!s) return; const c = s.channel("forecast-live").on("postgres_changes", { event: "*", schema: "public", table: "forecast_inputs" }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "bank_transactions" }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts" }, () => void load()).subscribe(); return () => { void s.removeChannel(c); }; }, []);

  const save = async () => {
    const s = getSupabaseBrowserClient(); if (!s) return;
    const { data: { user } } = await s.auth.getUser(); if (!user) return;
    setSaving(true);
    const period = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const { data } = await s.from("forecast_inputs").upsert({ user_id: user.id, period_start: period, ...inputs }, { onConflict: "user_id,period_start" }).select("updated_at").single();
    setSaving(false); if (data) setUpdated(data.updated_at);
  };

  async function reviewCurrentMonth() {
    const s = getSupabaseBrowserClient();
    if (!s) return;
    const { data: { user } } = await s.auth.getUser();
    if (!user) return;
    const selected = new Date(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01T12:00:00`);
    const currentPeriod = selected.toISOString().slice(0, 10);
    setReviewing(true); setReviewMessage(null);
    const expectedExpenses = inputs.fixed_commitments + inputs.variable_budget;
    const plannedNet = inputs.expected_income - expectedExpenses;
    const actualNet = actualIncome - actualExpenses;
    const variance = actualNet - plannedNet;
    const assessment = variance >= 50 ? "better_than_expected" : variance <= -50 ? "worse_than_expected" : "on_track";
    const result = await s.from("forecast_reviews").upsert({ user_id: user.id, period_start: currentPeriod, expected_income: inputs.expected_income, expected_expenses: expectedExpenses, actual_income: actualIncome, actual_expenses: actualExpenses, planned_net: plannedNet, actual_net: actualNet, variance, assessment }, { onConflict: "user_id,period_start" }).select("id,period_start,expected_income,expected_expenses,actual_income,actual_expenses,planned_net,actual_net,variance,assessment,notes").single();
    setReviewing(false);
    if (result.error) { setReviewMessage(`Évaluation impossible : ${result.error.message}`); return; }
    setReviews((current) => [result.data as Review, ...current.filter((r) => r.period_start !== currentPeriod)].slice(0, 6));
    setReviewMessage("✓ Écart du mois évalué et mémorisé.");
  }

  const learningSuggestion = useMemo(() => {
    const completed = reviews.filter((r) => r.assessment !== "pending");
    if (!completed.length) return null;
    const avgIncome = completed.reduce((s, r) => s + r.actual_income, 0) / completed.length;
    const avgExpenses = completed.reduce((s, r) => s + r.actual_expenses, 0) / completed.length;
    return { income: Number(avgIncome.toFixed(2)), variable: Number(Math.max(0, avgExpenses - inputs.fixed_commitments).toFixed(2)), count: completed.length };
  }, [reviews, inputs.fixed_commitments]);

  const points = useMemo<Point[]>(() => Array.from({ length: 6 }, (_, i) => {
    const date = new Date(); date.setMonth(date.getMonth() + i);
    const central = project(inputs, i + 1, 1)[i];
    return { label: monthLabel(date), central, favorable: project(inputs, i + 1, .75)[i], unfavorable: project(inputs, i + 1, 1.25)[i] - (i === 0 ? inputs.safety_reserve : 0) };
  }), [inputs]);

  const currentProjected = points[0]?.central ?? 0;
  const delta = actualBalance === null ? null : currentProjected - actualBalance;
  const confidence = transactionCount >= 10 ? "Bonne" : transactionCount >= 3 ? "Moyenne" : "Faible";

  const field = (key: keyof Inputs, label: string) => <label className="space-y-1 text-sm"><span className="font-medium">{label}</span><input type="number" step="0.01" value={inputs[key]} onChange={(e) => setInputs({ ...inputs, [key]: Number(e.target.value) })} className="w-full rounded-xl border bg-background px-3 py-2" /></label>;

  return <main className="app-surface-page mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-6 sm:py-8">
  <FinancialCrossDomainSummary context={financialContext} />
    <div className="app-page-hero"><p className="app-page-kicker">Prévision dynamique</p><h1 className="text-3xl font-bold">Mes prévisions</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Une projection lisible qui distingue les données observées des hypothèses. Les calculs sont déterministes ; l'IA intervient ensuite pour expliquer et prioriser.</p></div>

    <div className="grid gap-4 md:grid-cols-4">
      <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Solde réel</p><p className="financial-number mt-2 text-2xl font-bold">{actualBalance === null ? "—" : money(actualBalance)}</p><p className="mt-1 text-xs text-muted-foreground">Somme des comptes connus</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Fin de mois prévue</p><p className="financial-number mt-2 text-2xl font-bold">{money(currentProjected)}</p><p className="mt-1 text-xs text-muted-foreground">Scénario central</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Écart réel / prévision</p><p className={`financial-number mt-2 text-2xl font-bold ${delta !== null && delta < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{delta === null ? "—" : `${delta >= 0 ? "+" : ""}${money(delta)}`}</p><p className="mt-1 text-xs text-muted-foreground">Comparaison indicative</p></CardContent></Card>
      <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Confiance</p><p className="mt-2 text-2xl font-bold">{loading ? "—" : confidence}</p><p className="mt-1 text-xs text-muted-foreground">{transactionCount} transaction(s) ce mois</p></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Hypothèses éditables</CardTitle></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-5">{field("starting_balance", "Solde de départ")}{field("expected_income", "Revenus attendus")}{field("fixed_commitments", "Charges fixes")}{field("variable_budget", "Budget variable")}{field("safety_reserve", "Réserve de sécurité")}</div><div className="mt-4 flex flex-wrap items-center gap-3"><Button onClick={() => void save()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Enregistrement…" : "Enregistrer les hypothèses"}</Button><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button>{updated && <span className="text-xs text-muted-foreground">Mise à jour : {new Date(updated).toLocaleString("fr-FR")}</span>}</div></CardContent></Card>

    <div className="grid gap-6 lg:grid-cols-[1.5fr_.8fr]">
      <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Trajectoire sur 6 mois</CardTitle><div className="flex gap-4 text-xs text-muted-foreground"><span>— Central</span><span>— Scénarios</span></div></div></CardHeader><CardContent><ForecastChart points={points} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Scénarios</CardTitle></CardHeader><CardContent className="space-y-3">{([["Favorable", points[0]?.favorable ?? 0, TrendingUp], ["Central", points[0]?.central ?? 0, TrendingUp], ["Défavorable", points[0]?.unfavorable ?? 0, TrendingDown]] as [string, number, LucideIcon][]).map(([name, value, Icon]) => <div key={String(name)} className="rounded-xl border p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">{String(name)}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><p className={`financial-number mt-2 text-2xl font-bold ${Number(value) < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{money(Number(value))}</p><p className="mt-1 text-xs text-muted-foreground">{name === "Favorable" ? "Variables -25 %" : name === "Défavorable" ? "Variables +25 % et réserve" : "Hypothèses actuelles"}</p></div>)}</CardContent></Card>
    </div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" />Boucle d'apprentissage</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Net prévu</p><p className="financial-number mt-1 text-xl font-bold">{money(inputs.expected_income - inputs.fixed_commitments - inputs.variable_budget)}</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Net réel</p><p className="financial-number mt-1 text-xl font-bold">{money(actualIncome - actualExpenses)}</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Écart</p><p className={`financial-number mt-1 text-xl font-bold ${actualIncome - actualExpenses < inputs.expected_income - inputs.fixed_commitments - inputs.variable_budget ? "text-red-600 dark:text-red-400" : ""}`}>{`${(actualIncome - actualExpenses - (inputs.expected_income - inputs.fixed_commitments - inputs.variable_budget)) >= 0 ? "+" : ""}${money(actualIncome - actualExpenses - (inputs.expected_income - inputs.fixed_commitments - inputs.variable_budget))}`}</p></div>
          <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Mois évalués</p><p className="mt-1 text-xl font-bold">{reviews.length}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void reviewCurrentMonth()} disabled={reviewing || transactionCount === 0}><CheckCircle2 className="mr-2 h-4 w-4" />{reviewing ? "Évaluation…" : "Évaluer le mois"}</Button>
          {reviewMessage && <span className="text-xs text-muted-foreground">{reviewMessage}</span>}
        </div>
        {learningSuggestion && <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-semibold">Suggestion basée sur {learningSuggestion.count} mois évalué(s)</p>
          <p className="mt-1 text-sm text-muted-foreground">Le moteur propose de rapprocher les prochaines hypothèses de la réalité observée : revenus {money(learningSuggestion.income)} et budget variable {money(learningSuggestion.variable)}. Rien n'est enregistré automatiquement.</p>
          <Button variant="outline" className="mt-3" onClick={() => setInputs((current) => ({ ...current, expected_income: learningSuggestion.income, variable_budget: learningSuggestion.variable }))}>Utiliser ces valeurs comme brouillon</Button>
        </div>}
        {reviews.length > 0 && <div className="space-y-2">{reviews.slice(0, 3).map((r) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span className="font-medium capitalize">{new Date(`${r.period_start}T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span><span>Prévu {money(r.planned_net)} € · Réel {money(r.actual_net)} €</span><span className={r.variance < 0 ? "text-red-600 dark:text-red-400" : "text-[var(--success)] dark:text-emerald-400"}>{r.variance >= 0 ? "+" : ""}{money(r.variance)} €</span></div>)}</div>}
      </CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Réel vs hypothèses</CardTitle></CardHeader><CardContent><div className="mobile-rail grid gap-4 md:grid-cols-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Revenus observés ce mois</p><p className="financial-number mt-1 text-xl font-bold">{money(actualIncome)}</p><p className="text-xs text-muted-foreground">contre {money(inputs.expected_income)} attendus</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Dépenses observées ce mois</p><p className="financial-number mt-1 text-xl font-bold">{money(actualExpenses)}</p><p className="text-xs text-muted-foreground">hors interprétation IA</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Qualité des données</p><p className="mt-1 text-xl font-bold">{transactionCount === 0 ? "Insuffisante" : confidence}</p><p className="text-xs text-muted-foreground">Aucune donnée absente n'est interprétée comme zéro.</p></div></div></CardContent></Card>
  </main>;
}
