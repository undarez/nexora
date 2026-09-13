"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown, Sparkles } from "lucide-react";

export function BillingPlanBadge() {
  const [premium, setPremium] = useState<boolean | null>(null);
  useEffect(() => { void fetch("/api/billing/me", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => setPremium(data?.plan === "premium")).catch(() => {}); }, []);
  if (premium === null) return null;
  return <Link href="/tarifs" className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/40"><span className="rounded-full bg-primary/10 p-1">{premium ? <Crown className="h-3.5 w-3.5 text-primary" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}</span>{premium ? "Premium" : "Passer à Premium"}</Link>;
}
