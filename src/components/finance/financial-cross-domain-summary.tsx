"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, PiggyBank, WalletCards } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import type { UnifiedFinancialContext } from "@/lib/finance/unified-financial-context";

type Context = Pick<UnifiedFinancialContext, "period_start" | "liquidity" | "cashflow" | "budget" | "intelligence">;

const money = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function FinancialCrossDomainSummary({ month, context }: { month?: string; context?: Context | null }) {
  const [data, setData] = useState<Context | null>(context ?? null);

  useEffect(() => {
    if (context !== undefined) { setData(context ?? null); return; }
    let cancelled = false;
    const query = month ? `?month=${encodeURIComponent(month)}` : "";
    const load = async () => {
      try {
        const response = await fetch(`/api/finance/unified-context${query}`, { cache: "no-store" });
        const value = response.ok ? await response.json() as Context : null;
        if (!cancelled) setData(value);
      } catch {
        if (!cancelled) setData(null);
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [month, context]);

  useEffect(() => {
    if (context !== undefined) return;
    const onBankingUpdate = () => {
      const query = month ? `?month=${encodeURIComponent(month)}` : "";
      void fetch(`/api/finance/unified-context${query}`, { cache: "no-store" })
        .then(async r => r.ok ? await r.json() as Context : null)
        .then(v => { if (v) setData(v); })
        .catch(() => undefined);
    };
    window.addEventListener("nexora-banking-updated", onBankingUpdate);
    return () => window.removeEventListener("nexora-banking-updated", onBankingUpdate);
  }, [month, context]);

  if (!data) return null;
  const budgetUsage = data.budget.planned > 0 ? Math.min(data.budget.spent / data.budget.planned * 100, 100) : 0;

  return (
    <Card className="border-primary/15 bg-primary/[0.025]">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <WalletCards className="h-4 w-4 text-primary" />
            <span>Vue financière croisée</span>
            <span className="text-xs font-normal text-muted-foreground">comptes · transactions · budget · projection</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/banque" className="rounded-lg border bg-background px-2.5 py-1.5 font-medium hover:bg-muted">{data.liquidity.connected_accounts} compte(s) connecté(s)</Link>
            <Link href="/transactions" className="rounded-lg border bg-background px-2.5 py-1.5 font-medium hover:bg-muted">{data.cashflow.transaction_count} opération(s)</Link>
            <Link href="/budget" className="rounded-lg border bg-background px-2.5 py-1.5 font-medium hover:bg-muted">Budget {Math.round(budgetUsage)} % utilisé</Link>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Link href="/banque" className="rounded-xl border bg-background p-3 hover:border-primary/30">
            <p className="text-[11px] text-muted-foreground">Liquidité bancaire</p>
            <p className="mt-1 font-bold">{money(data.liquidity.connected_bank)}</p>
          </Link>
          <Link href="/transactions?kind=income" className="rounded-xl border bg-background p-3 hover:border-primary/30">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><ArrowUpRight className="h-3 w-3" /> Revenus</p>
            <p className="mt-1 font-bold">{money(data.cashflow.income)}</p>
          </Link>
          <Link href="/transactions?kind=expense" className="rounded-xl border bg-background p-3 hover:border-primary/30">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><ArrowDownRight className="h-3 w-3" /> Dépenses</p>
            <p className="mt-1 font-bold">{money(data.cashflow.expenses)}</p>
          </Link>
          <Link href={data.budget.projected_end < 0 ? "/previsions" : "/budget"} className="rounded-xl border bg-background p-3 hover:border-primary/30">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><PiggyBank className="h-3 w-3" /> Projection</p>
            <p className={`mt-1 font-bold ${data.budget.margin_to_reserve < 0 ? "text-destructive" : ""}`}>{money(data.budget.projected_end)}</p>
          </Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/transactions" className="rounded-xl border bg-background p-3 hover:border-primary/30">
            <p className="text-[11px] text-muted-foreground">Régularités détectées</p>
            <p className="mt-1 font-bold">{data.intelligence.recurring.length} récurrence(s)</p>
            <p className="mt-1 text-xs text-muted-foreground">À confirmer avant toute automatisation.</p>
          </Link>
          <Link href="/pilotage" className="rounded-xl border bg-background p-3 hover:border-primary/30">
            <p className="text-[11px] text-muted-foreground">Anomalies potentielles</p>
            <p className={`mt-1 font-bold ${data.intelligence.anomalies.length ? "text-destructive" : ""}`}>{data.intelligence.anomalies.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Comparaison statistique des dépenses observées.</p>
          </Link>
        </div>
        <div className="mt-3 flex justify-end">
          <Link href="/pilotage" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Piloter avec la vue complète <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </CardContent>
    </Card>
  );
}
