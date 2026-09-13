"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLAN_FEATURES, PREMIUM_PRICE_MONTHLY_EUR, PREMIUM_PRICE_YEARLY_EUR } from "@/lib/billing/entitlements";

type BillingState = { plan: "free" | "premium"; isAdmin: boolean; status: string };

export default function TarifsPage() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/billing/me", { cache: "no-store" }).then((r) => r.json()).then(setBilling).catch(() => setMessage("Impossible de charger votre offre.")); }, []);
  const checkout = async () => {
    setBusy(true); setMessage(null);
    try { const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Checkout indisponible."); window.location.href = data.url; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Checkout indisponible."); setBusy(false); }
  };
  return <main className="app-surface-page mx-auto max-w-6xl space-y-8 px-4 py-8 pb-24 sm:px-6">
    <section className="text-center"><p className="app-page-kicker">NEXORA · Tarifs</p><h1 className="app-page-title">Une offre simple, sans surprise.</h1><p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">Commence gratuitement. Passe à Premium quand tu veux plus d'automatisation, d'analyse et de puissance LIA.</p></section>
    {message && <div className="mx-auto max-w-2xl rounded-xl border border-primary/20 bg-primary/5 p-4 text-center text-sm">{message}</div>}
    <div className="grid gap-6 md:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Gratuit</CardTitle><p className="text-sm text-muted-foreground">Pour suivre ses finances au quotidien.</p><div className="pt-3 text-4xl font-bold">0 €<span className="text-sm font-normal text-muted-foreground"> / mois</span></div></CardHeader><CardContent><ul className="space-y-3">{PLAN_FEATURES.free.map((feature) => <li key={feature} className="flex gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{feature}</li>)}</ul><Button className="mt-6 w-full" variant={billing?.plan === "free" ? "default" : "outline"} disabled>{billing?.plan === "free" ? "Votre offre actuelle" : "Offre de base"}</Button></CardContent></Card>
      <Card className="relative overflow-hidden border-primary/40 shadow-lg"><div className="absolute right-4 top-4 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">RECOMMANDÉ</div><CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-primary" />Premium</CardTitle><p className="text-sm text-muted-foreground">Pour automatiser et piloter vraiment.</p><div className="pt-3 text-4xl font-bold">{PREMIUM_PRICE_MONTHLY_EUR.toFixed(2).replace(".", ",")} €<span className="text-sm font-normal text-muted-foreground"> / mois</span></div><p className="text-xs text-muted-foreground">ou {PREMIUM_PRICE_YEARLY_EUR.toFixed(2).replace(".", ",")} € / an</p></CardHeader><CardContent><ul className="space-y-3">{PLAN_FEATURES.premium.map((feature) => <li key={feature} className="flex gap-2 text-sm"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul>{billing?.isAdmin ? <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"><strong>Premium administrateur actif.</strong><br />Ton compte dispose de Premium gratuitement.</div> : <Button className="mt-6 w-full" onClick={() => void checkout()} disabled={busy || billing?.plan === "premium"}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ouverture de Stripe…</> : billing?.plan === "premium" ? "Premium actif" : "Passer à Premium"}</Button>}</CardContent></Card>
    </div>
  </main>;
}
