"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Point = { date: string; eur: number; currencies?: Record<string, number> };
type Period = "day" | "week" | "month" | "quarter" | "year" | "all";

const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const periodLabels: Record<Period, string> = { day: "Jour", week: "Semaine", month: "Mois", quarter: "3 mois", year: "Année", all: "Tout" };
const periodDays: Record<Period, number> = { day: 1, week: 7, month: 31, quarter: 93, year: 366, all: 3650 };

function shiftMonth(value: string, delta: number) {
  const date = new Date(`${value}-01T12:00:00`);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function BalanceHistoryCard() {
  const now = new Date();
  const [period, setPeriod] = useState<Period>("month");
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/banking/history?days=${periodDays[period]}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Historique bancaire indisponible.");
        if (!cancelled) setPoints(Array.isArray(data.points) ? data.points : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Historique bancaire indisponible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [period]);

  const visiblePoints = useMemo(() => {
    if (period !== "month") return points;
    return points.filter((point) => point.date.startsWith(selectedMonth));
  }, [points, period, selectedMonth]);

  const chart = useMemo(() => {
    const values = visiblePoints.map((point) => Number(point.eur)).filter(Number.isFinite);
    if (!values.length) return null;
    const width = 760;
    const height = 250;
    const padX = 16;
    const padY = 24;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const coords = visiblePoints.map((point, index) => ({
      x: padX + (index / Math.max(visiblePoints.length - 1, 1)) * (width - padX * 2),
      y: height - padY - ((Number(point.eur) - min) / range) * (height - padY * 2),
      point,
    }));
    return { width, height, min, max, coords, line: coords.map((p, index) => `${index === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") };
  }, [visiblePoints]);

  const title = period === "month"
    ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${selectedMonth}-01T12:00:00`))
    : periodLabels[period];

  const moveMonth = (delta: number) => setSelectedMonth((current) => shiftMonth(current, delta));

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Évolution de vos liquidités</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Solde bancaire réellement synchronisé, sans génération d’image.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = "/banque"}>Voir mes banques</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(periodLabels) as Period[]).map((value) => (
            <Button key={value} type="button" size="sm" variant={period === value ? "default" : "outline"} onClick={() => setPeriod(value)}>
              {periodLabels[value]}
            </Button>
          ))}
          {period === "month" && (
            <div className="ml-auto flex items-center gap-1 rounded-lg border px-1 py-1">
              <Button aria-label="Mois précédent" variant="ghost" size="icon" onClick={() => moveMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-32 text-center text-sm font-medium capitalize"><CalendarDays className="mr-1 inline h-4 w-4" />{title}</span>
              <Button aria-label="Mois suivant" variant="ghost" size="icon" onClick={() => moveMonth(1)} disabled={selectedMonth >= `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        {error ? <div className="flex h-64 items-center justify-center text-sm text-destructive">{error}</div> : chart ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{money(chart.max)}</span><span>{visiblePoints.length} relevé(s)</span><span>{money(chart.min)}</span></div>
            <div className="overflow-hidden rounded-xl border bg-background/30 p-2">
              <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-64 w-full" role="img" aria-label={`Évolution du solde bancaire : ${title}`}>
                <line x1="16" x2="744" y1="226" y2="226" stroke="currentColor" className="text-border" />
                <path d={chart.line} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" strokeLinecap="round" strokeLinejoin="round" />
                {chart.coords.map(({ x, y, point }) => <circle key={point.date} cx={x} cy={y} r="3.5" className="fill-primary"><title>{new Date(`${point.date}T12:00:00`).toLocaleDateString("fr-FR")} · {money(point.eur)}</title></circle>)}
              </svg>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>{new Date(`${visiblePoints[0].date}T12:00:00`).toLocaleDateString("fr-FR")}</span><span>{new Date(`${visiblePoints.at(-1)!.date}T12:00:00`).toLocaleDateString("fr-FR")}</span></div>
          </div>
        ) : <div className="flex h-64 flex-col items-center justify-center text-center"><TrendingUp className="h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">Aucun relevé pour cette période</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Connecte une banque puis synchronise-la. NEXORA conservera les relevés de solde pour permettre la consultation par jour, mois ou année.</p></div>}
      </CardContent>
    </Card>
  );
}
