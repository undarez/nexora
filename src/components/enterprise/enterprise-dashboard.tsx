"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, BarChart3, BrainCircuit, Building2, CalendarClock, CheckCircle2, FileText, Landmark, ReceiptText, RefreshCw, Sparkles, Target, TrendingUp, WalletCards } from "lucide-react";
import type { EnterpriseDashboardContext } from "@/lib/enterprise/dashboard-context";

const money = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")} %`;

function Metric({ label, value, note, icon: Icon, tone = "default" }: { label: string; value: string; note?: string; icon: LucideIcon; tone?: "default" | "positive" | "negative" }) {
  return <div className="rounded-2xl border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{label}</span><span className="rounded-xl bg-muted p-2"><Icon className="h-4 w-4" /></span></div>
    <p className={`mt-4 text-2xl font-bold tracking-tight ${tone === "positive" ? "text-emerald-500" : tone === "negative" ? "text-destructive" : ""}`}>{value}</p>
    {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
  </div>;
}

function FlowChart({ history }: { history: EnterpriseDashboardContext["history"] }) {
  const max = Math.max(...history.flatMap((x) => [x.income, x.expenses]), 1);
  return <div className="space-y-4">
    {history.map((item) => <div key={item.month} className="grid grid-cols-[70px_1fr_78px] items-center gap-3">
      <span className="text-xs text-muted-foreground capitalize">{item.label}</span>
      <div className="space-y-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, item.income / max * 100)}%` }} /></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-muted-foreground/50" style={{ width: `${Math.max(2, item.expenses / max * 100)}%` }} /></div>
      </div>
      <div className="text-right text-xs"><div className="font-semibold">{money(item.net)}</div><div className="text-muted-foreground">net</div></div>
    </div>)}
    <div className="flex gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> revenus</span><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> charges</span></div>
  </div>;
}

export function EnterpriseDashboard({ initial }: { initial: EnterpriseDashboardContext }) {
  const [data] = useState(initial);
  const [analysis, setAnalysis] = useState("");
  const [busy, setBusy] = useState(false);
  const f = data.financial;
  const netMargin = f.cashflow.income > 0 ? f.cashflow.net / f.cashflow.income * 100 : 0;
  const budgetUsage = f.budget.planned > 0 ? f.budget.spent / f.budget.planned * 100 : 0;
  const risk = f.budget.projected_end < 0 || f.budget.margin_to_reserve < 0 ? "À surveiller" : f.budget.margin_to_reserve < 100 ? "Vigilance" : "Saine";
  const riskTone = risk === "Saine" ? "text-emerald-500" : risk === "Vigilance" ? "text-amber-500" : "text-destructive";
  const currentMonth = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${f.period_start}T12:00:00`));
  const maxCategory = Math.max(...data.top_expenses.map((x) => x.amount), 1);
  const aiQuestion = useMemo(() => `Analyse la santé financière de ${data.company.name} pour ${currentMonth}. Utilise uniquement les données financières autorisées : revenus ${f.cashflow.income} €, dépenses ${f.cashflow.expenses} €, trésorerie ${f.liquidity.primary_total} €, budget prévu ${f.budget.planned} €, budget consommé ${f.budget.spent} €, projection fin de mois ${f.budget.projected_end} €. Identifie les tendances, anomalies et trois recommandations concrètes. N'invente aucune donnée comptable ou facture.`, [data.company.name, currentMonth, f]);

  const askLia = async () => {
    setBusy(true); setAnalysis("");
    try {
      const response = await fetch("/api/lia/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: aiQuestion }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analyse indisponible.");
      setAnalysis(result.analysis || result.message || "Aucune analyse reçue.");
    } catch (error) { setAnalysis(error instanceof Error ? error.message : "Analyse indisponible."); }
    finally { setBusy(false); }
  };

  return <main className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-24 pt-5 sm:px-6 lg:px-8">
    <section className="overflow-hidden rounded-[2rem] border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl"><div className="mb-3 flex items-center gap-2 text-emerald-300"><Building2 className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.18em]">NEXORA · Entreprise</span>{data.company.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-[11px]"><CheckCircle2 className="h-3 w-3" /> SIRET vérifié</span>}</div><h1 className="text-3xl font-semibold sm:text-4xl">{data.company.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Un cockpit unique qui reprend les données déjà saisies dans Gérer Finance : comptes, transactions, budget, charges, objectifs, prévisions et signaux LIA.</p><div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">{data.company.legal_form && <span className="rounded-full border border-white/10 px-3 py-1.5">{data.company.legal_form}</span>}{data.company.siret && <span className="rounded-full border border-white/10 px-3 py-1.5">SIRET {data.company.siret}</span>}{data.company.activity_label && <span className="rounded-full border border-white/10 px-3 py-1.5">{data.company.activity_label}</span>}</div></div>
        <div className="flex flex-wrap gap-2"><Link href="/banque" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">Comptes</Link><Link href="/transactions" className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10">Transactions</Link><Link href="/previsions" className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400">Prévisions</Link></div>
      </div>
    </section>

    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Identité légale</p>
          <h2 className="mt-1 text-lg font-bold">Établissement vérifié</h2>
          <p className="mt-1 text-sm text-muted-foreground">Les informations légales affichées ci-dessous proviennent du profil vérifié à partir du SIRET.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> SIRET vérifié</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">SIRET</p><p className="mt-1 font-semibold">{data.company.siret || "—"}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">SIREN</p><p className="mt-1 font-semibold">{data.company.siren || "—"}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Forme juridique</p><p className="mt-1 font-semibold">{data.company.legal_form || "—"}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Localisation</p><p className="mt-1 font-semibold">{data.company.city || "—"}</p></div>
      </div>
    </section>

    <nav className="sticky top-2 z-10 flex gap-2 overflow-x-auto rounded-2xl border bg-background/90 p-2 shadow-sm backdrop-blur"><a href="#vue" className="shrink-0 rounded-xl bg-muted px-3 py-2 text-xs font-semibold">Vue d'ensemble</a><a href="#activite" className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-muted">Activité</a><a href="#rentabilite" className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-muted">Rentabilité</a><a href="#tresorerie" className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-muted">Trésorerie</a><a href="#prevision" className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-muted">Prévisionnel</a><a href="#ia" className="shrink-0 rounded-xl px-3 py-2 text-xs font-semibold hover:bg-muted">IA</a></nav>

    <section id="vue" className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Vue d'ensemble</p><h2 className="mt-1 text-2xl font-bold">La santé financière, en un coup d'œil</h2><p className="mt-1 text-sm text-muted-foreground">Période analysée : {currentMonth} · actualisée à partir des données disponibles.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Revenus / CA observé" value={money(f.cashflow.income)} note={`${f.cashflow.transaction_count} opérations`} icon={ArrowUpRight} tone="positive" /><Metric label="Charges observées" value={money(f.cashflow.expenses)} note={`${data.fixed_commitments ? money(data.fixed_commitments) : "0 €"} de charges fixes`} icon={ArrowDownRight} /><Metric label="Solde des flux" value={money(f.cashflow.net)} note={`marge de flux ${pct(netMargin)}`} icon={TrendingUp} tone={f.cashflow.net >= 0 ? "positive" : "negative"} /><Metric label="Trésorerie" value={money(f.liquidity.primary_total)} note={`${f.liquidity.connected_accounts} compte(s) connecté(s)`} icon={WalletCards} /></div></section>

    <section id="activite" className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
      <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Activité</p><h2 className="mt-1 text-lg font-bold">Revenus, charges et évolution</h2><p className="mt-1 text-xs text-muted-foreground">Les six derniers mois disponibles dans tes transactions.</p></div><BarChart3 className="h-5 w-5 text-muted-foreground" /></div><div className="mt-6"><FlowChart history={data.history} /></div></div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Principales charges</p><h2 className="mt-1 text-lg font-bold">Où part l'argent ?</h2><div className="mt-5 space-y-4">{data.top_expenses.length ? data.top_expenses.map((item) => <div key={item.category}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{item.category}</span><strong>{money(item.amount)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, item.amount / maxCategory * 100)}%` }} /></div></div>) : <p className="text-sm text-muted-foreground">Aucune dépense catégorisée.</p>}</div><Link href="/transactions" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary">Voir les transactions <ArrowRight className="h-3.5 w-3.5" /></Link></div>
    </section>

    <section id="rentabilite" className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /><h2 className="font-bold">Rentabilité de flux</h2></div><p className="mt-2 text-sm text-muted-foreground">Indicateur opérationnel calculé à partir des flux réellement enregistrés, pas un résultat comptable.</p><div className="mt-6 text-3xl font-bold">{pct(netMargin)}</div><p className="mt-1 text-xs text-muted-foreground">{money(f.cashflow.net)} de solde pour {money(f.cashflow.income)} de revenus.</p></div>
      <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /><h2 className="font-bold">Comptabilité</h2></div><p className="mt-2 text-sm text-muted-foreground">Bilan, compte de résultat, TVA et SIG ne sont pas inventés tant qu'une source comptable n'est pas connectée.</p><div className="mt-5 rounded-xl border border-dashed p-4 text-sm"><span className="font-semibold">En attente d'une source comptable</span><p className="mt-1 text-xs text-muted-foreground">Quand elle sera disponible, LIA pourra exploiter ces indicateurs ici.</p></div></div>
      <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /><h2 className="font-bold">Objectifs</h2></div><div className="mt-4 space-y-3">{f.goals.length ? f.goals.slice(0, 4).map((goal, index) => <div key={`${goal.name || "goal"}-${index}`} className="rounded-xl border p-3"><div className="flex justify-between gap-2 text-sm"><span className="truncate">{goal.name}</span><strong>{money(goal.current_amount)} / {money(goal.target_amount)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, goal.target_amount > 0 ? goal.current_amount / goal.target_amount * 100 : 0)}%` }} /></div></div>) : <p className="text-sm text-muted-foreground">Aucun objectif financier enregistré.</p>}</div></div>
    </section>

    <section id="tresorerie" className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Trésorerie</p><h2 className="mt-1 text-lg font-bold">Position actuelle</h2></div><Landmark className="h-5 w-5 text-muted-foreground" /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Total</p><p className="mt-1 text-xl font-bold">{money(f.liquidity.primary_total)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Disponible bancaire</p><p className="mt-1 text-xl font-bold">{money(f.liquidity.available_by_currency[f.liquidity.primary_currency] || 0)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Charges fixes</p><p className="mt-1 text-xl font-bold">{money(data.fixed_commitments)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Réserve de sécurité</p><p className="mt-1 text-xl font-bold">{money(f.budget.safety_reserve)}</p></div></div><Link href="/banque" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary">Gérer les comptes bancaires <ArrowRight className="h-3.5 w-3.5" /></Link></div>
      <div className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Prévision</p><h2 className="mt-1 text-lg font-bold">Atterrissage du mois</h2></div><CalendarClock className="h-5 w-5 text-muted-foreground" /></div><div className="mt-5 space-y-4"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Budget prévu</span><strong>{money(f.budget.planned)}</strong></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Budget consommé</span><strong>{money(f.budget.spent)} · {budgetUsage.toFixed(0)} %</strong></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, budgetUsage))}%` }} /></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Projection fin de mois</p><p className={`mt-1 text-xl font-bold ${f.budget.projected_end < 0 ? "text-destructive" : ""}`}>{money(f.budget.projected_end)}</p></div><div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Marge / réserve</p><p className={`mt-1 text-xl font-bold ${f.budget.margin_to_reserve < 0 ? "text-destructive" : ""}`}>{money(f.budget.margin_to_reserve)}</p></div></div></div><Link href="/previsions" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary">Ouvrir le prévisionnel <ArrowRight className="h-3.5 w-3.5" /></Link></div>
    </section>

    <section className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" /><h2 className="font-bold">Clients & fournisseurs</h2></div><p className="mt-2 text-sm text-muted-foreground">Le socle actuel ne contient pas encore de factures clients/fournisseurs structurées.</p><div className="mt-4 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">Quand les factures seront intégrées, cette zone affichera meilleurs clients, fournisseurs, impayés et échéances.</div></div>
      <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h2 className="font-bold">Données disponibles</h2></div><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Transactions</span><strong>{data.data_quality.transaction_count}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Comptes connectés</span><strong>{data.data_quality.connected_accounts}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Budget</span><strong>{data.data_quality.budget_available ? "Actif" : "Non configuré"}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Comptabilité</span><strong>À connecter</strong></div></div></div>
      <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /><h2 className="font-bold">État de pilotage</h2></div><p className={`mt-3 text-2xl font-bold ${riskTone}`}>{risk}</p><p className="mt-1 text-sm text-muted-foreground">Projection, réserve et flux sont pris en compte. LIA reste en proposition et n'exécute aucune décision financière sensible.</p><Link href="/lia" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">Parler à LIA <ArrowRight className="h-3.5 w-3.5" /></Link></div>
    </section>

    <section id="prevision" className="rounded-2xl border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Prévisionnel</p><h2 className="mt-1 text-lg font-bold">Un seul endroit pour comprendre l'atterrissage</h2><p className="mt-1 text-sm text-muted-foreground">Le module reprend le budget, les charges fixes et les projections déjà présentes dans Gérer Finance.</p></div><div className="flex gap-2"><Link href="/budget" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted">Budget</Link><Link href="/previsions" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Prévisions</Link></div></div></section>

    <section id="ia" className="rounded-[1.75rem] border border-primary/20 bg-primary/[0.035] p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-3xl"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">IA financière</p></div><h2 className="mt-2 text-2xl font-bold">LIA transforme les chiffres en décisions compréhensibles</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">L'analyse utilise le même socle de données que le reste de Gérer Finance. Elle doit expliciter ses sources, signaler les données manquantes et proposer avant toute action sensible.</p></div><button type="button" onClick={askLia} disabled={busy} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />{busy ? "Analyse…" : "Analyser avec LIA"}</button></div>{analysis && <div className="mt-5 whitespace-pre-wrap rounded-2xl border bg-card p-5 text-sm leading-6">{analysis}</div>}</section>

    <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/30 p-4 text-xs text-muted-foreground"><span>Source : données disponibles dans Gérer Finance · aucune donnée comptable ou facture inventée.</span><span className="font-semibold">Dernière génération : {new Date(data.generated_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></footer>
  </main>;
}
