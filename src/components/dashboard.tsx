"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Landmark,
  PiggyBank,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { UnifiedFinancialContext } from "@/lib/finance/unified-financial-context";

type FixedExpense = {
  id: string;
  label: string;
  sector: string;
  amount: number;
  recurrence: string;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
};

type RecentTx = {
  id: string;
  label: string;
  amount: number;
  date: string;
  category: string;
  source: "bank" | "manual";
};

const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

const monthLabel = (v: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(`${v}T12:00:00`)
  );

const money = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v);

const money2 = (v: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const signedMoney = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))} €`;

export function Dashboard() {
  const [month] = useState(monthKey());
  const [financialContext, setFinancialContext] =
    useState<UnifiedFinancialContext | null>(null);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [realBalance, setRealBalance] = useState(0);
  const [realIncome, setRealIncome] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [recentTransactions, setRecentTransactions] = useState<RecentTx[]>([]);
  const [scenarioExtraExpense, setScenarioExtraExpense] = useState(0);
  const [scenarioIncomeDelta, setScenarioIncomeDelta] = useState(0);
  const [scenarioSaving, setScenarioSaving] = useState(0);
  const [bankRefreshBusy, setBankRefreshBusy] = useState(false);
  const [bankRefreshError, setBankRefreshError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const [contextResponse, profile, bankRecent, manualRecent] =
        await Promise.all([
          fetch(
            `/api/finance/unified-context?month=${encodeURIComponent(month)}`,
            { cache: "no-store" }
          ),
          supabase
            .from("profiles")
            .select("display_name")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("bank_transactions")
            .select(
              "id,amount,booked_at,description,merchant_name,category"
            )
            .eq("user_id", user.id)
            .order("booked_at", { ascending: false })
            .limit(6),
          supabase
            .from("transactions")
            .select("id,amount,occurred_at,label,categories(name)")
            .eq("user_id", user.id)
            .order("occurred_at", { ascending: false })
            .limit(6),
        ]);

      const context = contextResponse.ok
        ? ((await contextResponse.json()) as UnifiedFinancialContext)
        : null;

      if (context) {
        setFinancialContext(context);
        setRealBalance(Number(context.liquidity.primary_total || 0));
        setRealIncome(Number(context.cashflow.income || 0));
        setFixedExpenses(
          context.budget.fixed_items.map((x) => ({
            id: x.id,
            label: x.label,
            sector: x.sector,
            amount: Number(x.amount),
            recurrence: x.recurrence,
            effective_from: month,
            effective_until: null,
            is_active: true,
          }))
        );
      }

      if (!profile.error) setDisplayName(profile.data?.display_name ?? "");

      const bankRows = (bankRecent.data ?? []).map((tx: any) => ({
        id: `bank:${tx.id}`,
        label: String(
          tx.merchant_name || tx.description || "Opération bancaire"
        ),
        amount: Number(tx.amount || 0),
        date: String(tx.booked_at || "").slice(0, 10),
        category: String(tx.category || "Opération"),
        source: "bank" as const,
      }));

      const manualRows = (manualRecent.data ?? []).map((tx: any) => {
        const rel = Array.isArray(tx.categories)
          ? tx.categories[0]
          : tx.categories;
        return {
          id: `manual:${tx.id}`,
          label: String(tx.label || "Transaction"),
          amount: Number(tx.amount || 0),
          date: String(tx.occurred_at || "").slice(0, 10),
          category: String(rel?.name || "Opération"),
          source: "manual" as const,
        };
      });

      setRecentTransactions(
        [...bankRows, ...manualRows]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 6)
      );
    } catch {
      setFinancialContext(null);
    }
  }, [month]);

  const refreshBanking = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setBankRefreshBusy(true);
    setBankRefreshError(null);
    try {
      const response = await fetch("/api/banking/sync-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Impossible de synchroniser les comptes bancaires."
        );
      }

      if (Number(payload?.failedCount ?? 0) > 0) {
        setBankRefreshError(
          "Certaines connexions bancaires n'ont pas pu être synchronisées."
        );
      }

      // Re-read the same financial model used by the dashboard after the
      // Open Banking synchronization has completed.
      await load();
    } catch (error) {
      setBankRefreshError(
        error instanceof Error
          ? error.message
          : "Actualisation bancaire indisponible."
      );
      await load();
    } finally {
      setBankRefreshBusy(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;
    let channel: any = null;
    let reloadTimer: number | null = null;

    const scheduleLoad = () => {
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        reloadTimer = null;
        void load();
      }, 250);
    };

    const setup = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) return;

      channel = supabase.channel(
        `dashboard-live-${user.id}-${crypto.randomUUID()}`
      );

      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "budget_scenarios",
            filter: `user_id=eq.${user.id}`,
          },
          scheduleLoad
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "fixed_expenses",
            filter: `user_id=eq.${user.id}`,
          },
          scheduleLoad
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          scheduleLoad
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "accounts",
            filter: `user_id=eq.${user.id}`,
          },
          scheduleLoad
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bank_accounts",
            filter: `user_id=eq.${user.id}`,
          },
          scheduleLoad
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bank_transactions",
            filter: `user_id=eq.${user.id}`,
          },
          scheduleLoad
        );

      if (cancelled) {
        supabase.removeChannel(channel);
        channel = null;
        return;
      }

      channel.subscribe((status: string) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[dashboard] Realtime channel error");
        }
      });
    };

    void setup();

    return () => {
      cancelled = true;
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load]);

  const currentScenario = useMemo(
    () => ({
      income: financialContext?.budget.income_planned ?? realIncome,
      startingBalance:
        financialContext?.budget.starting_balance ?? realBalance,
      safetyReserve: financialContext?.budget.safety_reserve ?? 100,
      extraExpense: financialContext?.budget.extra_expense ?? 0,
      weeksRemaining: Math.max(
        financialContext?.budget.weeks_remaining ?? 4,
        1
      ),
      variableRemaining: Math.max(
        financialContext?.budget.variable_remaining ?? 0,
        0
      ),
    }),
    [financialContext, realBalance, realIncome]
  );

  const fixedTotal = Number(
    financialContext?.budget.fixed_commitments ?? 0
  );

  const baselineProjection = Number(
    financialContext?.budget.projected_end ??
      currentScenario.startingBalance +
        currentScenario.income -
        fixedTotal -
        currentScenario.variableRemaining -
        currentScenario.extraExpense
  );

  const simulatedProjection =
    baselineProjection +
    scenarioIncomeDelta -
    scenarioExtraExpense +
    scenarioSaving;

  const baselineMargin =
    baselineProjection - currentScenario.safetyReserve;
  const simulatedMargin =
    simulatedProjection - currentScenario.safetyReserve;

  const netMonth =
    realIncome - Number(financialContext?.cashflow.expenses ?? 0);

  const projectedStatus =
    baselineProjection < 0
      ? "Vigilance"
      : baselineMargin < 0
        ? "À surveiller"
        : "Maîtrisée";

  const simulatedStatus =
    simulatedProjection < 0
      ? "Sous zéro"
      : simulatedMargin < 0
        ? "Sous la réserve"
        : "Au-dessus de la réserve";

  const goals = financialContext?.goals ?? [];
  const anomalies = financialContext?.intelligence.anomalies ?? [];
  const recurring = financialContext?.intelligence.recurring ?? [];

  const connected = Math.max(
    Number(financialContext?.liquidity.connected_bank ?? 0),
    0
  );
  const manual = Math.max(
    Number(financialContext?.liquidity.manual_accounts ?? 0),
    0
  );
  const liquidTotal = connected + manual;
  const connectedPct =
    liquidTotal > 0 ? Math.round((connected / liquidTotal) * 100) : 0;

  const primaryGoal = goals[0];
  const goalProgress = primaryGoal
    ? Math.min(
        100,
        Math.max(
          0,
          (primaryGoal.current_amount /
            Math.max(primaryGoal.target_amount, 1)) *
            100
        )
      )
    : 0;

  const dataPeriod = financialContext?.period_start && financialContext?.period_end
    ? `${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(`${financialContext.period_start}T12:00:00`))} → ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(`${financialContext.period_end}T12:00:00`))}`
    : "période courante";

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 pb-24 pt-5 sm:px-6 sm:pb-10 sm:pt-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Vue d’ensemble
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Où en est mon argent aujourd’hui ?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bonjour{displayName ? ` ${displayName}` : ""} 👋 Voici les
            éléments utiles pour décider sans mélanger réel et projection.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm">
          <CalendarDays className="h-4 w-4" />
          <span className="capitalize">{monthLabel(month)}</span>
        </div>
      </header>

      <section className="dashboard-priority-grid">
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Situation réelle
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <strong className="text-4xl font-bold tracking-tight">
                      {money2(realBalance)} €
                    </strong>
                    <span className="mb-1 text-sm text-muted-foreground">
                      liquidités disponibles
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold">
                  <CircleDollarSign className="h-3.5 w-3.5" />
                  Réel
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Revenus observés</p>
                  <p className="mt-1 font-semibold text-emerald-600">
                    {signedMoney(realIncome)}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Dépenses observées</p>
                  <p className="mt-1 font-semibold">
                    {money2(Number(financialContext?.cashflow.expenses ?? 0))} €
                  </p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Net observé</p>
                  <p
                    className={`mt-1 font-semibold ${netMonth >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {signedMoney(netMonth)}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Fin de mois</p>
                    <p className="text-xs text-muted-foreground">
                      Projection conditionnelle · réserve cible{" "}
                      {money(currentScenario.safetyReserve)} €
                    </p>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-xs font-semibold">
                    {projectedStatus}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <strong className="text-2xl">{signedMoney(baselineProjection)}</strong>
                  <span
                    className={`text-sm font-medium ${baselineMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {baselineMargin >= 0 ? "+" : ""}
                    {money2(baselineMargin)} € vs réserve
                  </span>
                </div>
              </div>
            </div>
            <div className="border-t bg-muted/30 px-5 py-3 text-xs text-muted-foreground sm:px-7">
              <span className="font-medium text-foreground">Réel</span> =
              transactions et soldes observés.{" "}
              <span className="font-medium text-foreground">Projection</span>{" "}
              = hypothèse de planification, jamais une certitude.
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Ce qui mérite ton attention</CardTitle>
              <Link
                href="/pilotage"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Détails <ChevronRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {baselineMargin < 0 && (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold">La projection passe sous la réserve.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Marge projetée : {money2(baselineMargin)} €.
                  </p>
                </div>
              </div>
            )}
            {anomalies.slice(0, 2).map((item) => (
              <div key={item.id} className="flex gap-3 rounded-xl border p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {money2(item.amount)} € · {item.category}
                  </p>
                </div>
              </div>
            ))}
            {baselineMargin >= 0 && anomalies.length === 0 && (
              <div className="flex gap-3 rounded-xl border p-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold">Aucun point bloquant détecté.</p>
                  <p className="text-xs text-muted-foreground">
                    La situation observée reste lisible sur la période disponible.
                  </p>
                </div>
              </div>
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              Base de lecture : {dataPeriod} jours de données financières disponibles.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600">
              <Landmark className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Disponible</p>
              <p className="font-bold">{money2(realBalance)} €</p>
              <p className="text-[11px] text-muted-foreground">situation réelle</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Net observé</p>
              <p className="font-bold">{signedMoney(netMonth)}</p>
              <p className="text-[11px] text-muted-foreground">sur la période du mois</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl bg-violet-500/10 p-2.5 text-violet-600">
              <TrendingDown className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Fixes pris en compte</p>
              <p className="font-bold">{money2(fixedTotal)} €</p>
              <p className="text-[11px] text-muted-foreground">
                {fixedExpenses.length} engagement(s)
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <span className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Réserve cible</p>
              <p className="font-bold">{money(currentScenario.safetyReserve)} €</p>
              <p className="text-[11px] text-muted-foreground">{projectedStatus}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Où part mon argent ?</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Les dérives budgétaires sont séparées des flux réels.
                </p>
              </div>
              <Link href="/budget" className="text-xs font-semibold text-muted-foreground">
                Budget <ChevronRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(financialContext?.budget.envelopes ?? []).slice(0, 5).map((env) => {
                const planned = Number(env.planned || 0);
                const spent = Number(env.spent || 0);
                const ratio = planned > 0 ? Math.min(100, (spent / planned) * 100) : 100;
                const over = planned > 0 && spent > planned;
                return (
                  <div key={env.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{env.name}</span>
                      <span className={over ? "font-semibold text-red-600" : "text-muted-foreground"}>
                        {money2(spent)} / {money2(planned)} €
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${over ? "bg-red-500" : "bg-foreground"}`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {!(financialContext?.budget.envelopes?.length) && (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Aucun budget par enveloppe disponible pour cette période.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Comptes & liquidités</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bankRefreshError ?? "Photographie actuelle des comptes bancaires."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void refreshBanking()}
                  disabled={bankRefreshBusy}
                  aria-label="Synchroniser les comptes bancaires"
                  title="Synchroniser les comptes bancaires"
                >
                  <RefreshCw className={`h-4 w-4 ${bankRefreshBusy ? "animate-spin" : ""}`} />
                  <span className="ml-1.5">Synchroniser</span>
                </Button>
                <Link href="/banque" className="text-xs font-semibold text-muted-foreground">
                  Voir le détail <ChevronRight className="inline h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-center">
              <div
                className="mx-auto grid h-32 w-32 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(currentColor ${connectedPct}%, hsl(var(--muted)) 0)`,
                }}
              >
                <div className="grid h-24 w-24 place-items-center rounded-full bg-background text-center">
                  <strong className="text-lg">{money(liquidTotal)} €</strong>
                  <span className="text-[10px] text-muted-foreground">liquidités</span>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <i className="h-2.5 w-2.5 rounded-full bg-foreground" />
                    Comptes connectés
                  </span>
                  <strong>{money2(connected)} €</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <i className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                    Comptes manuels
                  </span>
                  <strong>{money2(manual)} €</strong>
                </div>
                <p className="text-xs text-muted-foreground">
                  {bankRefreshBusy
                    ? "Synchronisation des comptes en cours…"
                    : "Les comptes sont présentés comme une photographie actuelle, pas comme une projection."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Jusqu’à la fin du mois</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Réalisé → engagements → projection.
                </p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-xs">Hypothèse</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Observé</p>
                <strong className="mt-1 block text-xl">{signedMoney(netMonth)}</strong>
                <p className="mt-1 text-xs text-muted-foreground">flux déjà constatés</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Engagements</p>
                <strong className="mt-1 block text-xl">{money2(fixedTotal)} €</strong>
                <p className="mt-1 text-xs text-muted-foreground">charges fixes connues</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">Projection</p>
                <strong className="mt-1 block text-xl">{signedMoney(baselineProjection)}</strong>
                <p className="mt-1 text-xs text-muted-foreground">conditionnelle</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Objectif principal</CardTitle>
          </CardHeader>
          <CardContent>
            {primaryGoal ? (
              <div className="flex items-center gap-4">
                <div className="relative grid h-20 w-20 place-items-center rounded-full bg-muted">
                  <div className="absolute inset-1 grid place-items-center rounded-full bg-background">
                    <strong>{Math.round(goalProgress)}%</strong>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{primaryGoal.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {money(primaryGoal.current_amount)} € / {money(primaryGoal.target_amount)} €
                  </p>
                  <Link href="/pilotage" className="mt-2 inline-flex items-center text-xs font-semibold">
                    Suivre l’objectif <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-4">
                <Target className="h-6 w-6 text-muted-foreground" />
                <p className="mt-2 font-semibold">Aucun objectif configuré</p>
                <Link href="/pilotage" className="mt-2 inline-flex text-sm font-semibold">
                  Créer un objectif <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Et si… ?</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Une simulation locale et non destructive. Elle ne modifie ni budget, ni transaction, ni compte.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" /> Simulation
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="rounded-xl border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Dépense supplémentaire
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={scenarioExtraExpense}
                      onChange={(e) => setScenarioExtraExpense(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-lg font-semibold outline-none"
                      aria-label="Dépense supplémentaire"
                    />
                    <span className="text-sm text-muted-foreground">€</span>
                  </div>
                </label>
                <label className="rounded-xl border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Revenu en plus
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={scenarioIncomeDelta}
                      onChange={(e) => setScenarioIncomeDelta(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-lg font-semibold outline-none"
                      aria-label="Revenu supplémentaire"
                    />
                    <span className="text-sm text-muted-foreground">€</span>
                  </div>
                </label>
                <label className="rounded-xl border p-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Épargne en plus
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={scenarioSaving}
                      onChange={(e) => setScenarioSaving(Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-lg font-semibold outline-none"
                      aria-label="Épargne supplémentaire"
                    />
                    <span className="text-sm text-muted-foreground">€</span>
                  </div>
                </label>
              </div>

              <div className="min-w-[230px] rounded-2xl border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground">Projection simulée</p>
                <strong className="mt-1 block text-3xl">{signedMoney(simulatedProjection)}</strong>
                <p className={`mt-1 text-sm font-semibold ${simulatedMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {simulatedStatus}
                </p>
                <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  Écart vs scénario actuel :{" "}
                  <span className="font-semibold text-foreground">
                    {signedMoney(simulatedProjection - baselineProjection)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Transactions récentes</CardTitle>
              <Link href="/transactions" className="text-xs font-semibold text-muted-foreground">
                Tout voir <ChevronRight className="inline h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentTransactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 rounded-lg px-1 py-2.5">
                <span className={`rounded-full p-2 ${tx.amount >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                  {tx.amount >= 0 ? (
                    <ArrowDownRight className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{tx.label}</strong>
                  <small className="text-xs text-muted-foreground">
                    {tx.date
                      ? new Intl.DateTimeFormat("fr-FR", {
                          day: "numeric",
                          month: "short",
                        }).format(new Date(`${tx.date}T12:00:00`))
                      : ""}{" "}
                    · {tx.category}
                  </small>
                </div>
                <b className={tx.amount >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {signedMoney(tx.amount)}
                </b>
              </div>
            ))}
            {recentTransactions.length === 0 && (
              <p className="py-5 text-sm text-muted-foreground">
                Aucune transaction récente.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Récurrents & objectifs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-violet-500/10 p-2 text-violet-600">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">
                    {recurring.length
                      ? `${recurring.length} flux récurrent(s)`
                      : "Aucun flux récurrent détecté"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vérifie les abonnements et charges récurrentes.
                  </p>
                </div>
              </div>
              <Link href="/budget" aria-label="Voir les récurrents">
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                  <PiggyBank className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">
                    {goals.length
                      ? `${goals.length} objectif(s) suivi(s)`
                      : "Aucun objectif suivi"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Les objectifs restent séparés des transactions.
                  </p>
                </div>
              </div>
              <Link href="/pilotage" aria-label="Voir les objectifs">
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/transactions?quick=expense"
          className="group rounded-xl border bg-background p-4 transition hover:bg-muted/50"
        >
          <Plus className="h-5 w-5" />
          <p className="mt-3 font-semibold">Ajouter une dépense</p>
          <p className="text-xs text-muted-foreground">Enregistrer une opération.</p>
        </Link>
        <Link
          href="/budget"
          className="group rounded-xl border bg-background p-4 transition hover:bg-muted/50"
        >
          <PiggyBank className="h-5 w-5" />
          <p className="mt-3 font-semibold">Gérer mon budget</p>
          <p className="text-xs text-muted-foreground">Modifier les hypothèses.</p>
        </Link>
        <Link
          href="/transactions"
          className="group rounded-xl border bg-background p-4 transition hover:bg-muted/50"
        >
          <ArrowRight className="h-5 w-5" />
          <p className="mt-3 font-semibold">Analyser mes dépenses</p>
          <p className="text-xs text-muted-foreground">Voir les flux à la source.</p>
        </Link>
        <Link
          href="/lia"
          className="group rounded-xl border bg-background p-4 transition hover:bg-muted/50"
        >
          <Sparkles className="h-5 w-5" />
          <p className="mt-3 font-semibold">Ouvrir LIA</p>
          <p className="text-xs text-muted-foreground">
            Poser une question à l’assistant.
          </p>
        </Link>
      </section>

      <footer className="flex flex-col gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Les calculs affichés ici sont des lectures et simulations. Aucune
          action financière n’est exécutée depuis le dashboard.
        </span>
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Données tenantisées
        </span>
      </footer>
    </main>
  );
}
