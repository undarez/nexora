"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BellRing, Check, ChevronRight, Sparkles, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { refreshNotifications } from "@/lib/notifications/client-refresh";

const watchedTables = ["transactions", "budget_scenarios", "accounts", "wealth_entries", "forecast_inputs"] as const;

type LivePrompt = { id: number; title: string; message: string; href: string; actionLabel?: string };

function promptFor(table: string, event: string): LivePrompt {
  if (table === "transactions") return { id: Date.now(), title: "Nexo a vu un changement", message: event === "INSERT" ? "Une nouvelle opération vient d'entrer. Je peux vérifier son impact sur votre budget." : "Une opération vient d'être modifiée. Je peux vérifier l'impact sur vos prévisions.", href: "/transactions" };
  if (table === "budget_scenarios") return { id: Date.now(), title: "Nexo surveille votre budget", message: "Votre budget vient de changer. Je peux vérifier la dérive et la marge restante.", href: "/budget" };
  if (table === "forecast_inputs") return { id: Date.now(), title: "Nexo a détecté une nouvelle hypothèse", message: "Je peux comparer cette hypothèse avec les résultats réels.", href: "/previsions" };
  if (table === "wealth_entries") return { id: Date.now(), title: "Nexo a vu votre patrimoine évoluer", message: "Je peux vérifier l'évolution de votre patrimoine.", href: "/patrimoine" };
  return { id: Date.now(), title: "Nexo a détecté un changement", message: "Je peux vérifier l'impact de cette modification sur votre situation.", href: "/pilotage" };
}

export function NexoLiveObserver() {
  const [prompt, setPrompt] = useState<LivePrompt | null>(null);
  const timer = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let armTimer: number | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      // Do not react to the initial page load. Only real subsequent changes are actionable.
      armTimer = window.setTimeout(() => { if (!cancelled) armed.current = true; }, 1200);
      channel = supabase.channel(`nexo-live-${user.id}-${crypto.randomUUID()}`);
      watchedTables.forEach((table) => {
        channel = channel!.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${user.id}` }, async (payload) => {
          if (!armed.current) return;
          const next = promptFor(table, payload.eventType);
          setPrompt(next);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setPrompt(null), 12000);
          // The browser reports only the event class. The server decides whether an intervention is warranted.
          const response = await fetch("/api/lia/observe", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ table, event: payload.eventType }),
          }).catch(() => null);
          const result = response && response.ok ? await response.json().catch(() => null) : null;
          const intervention = result?.intervention;
          if (intervention) {
            setPrompt({ id: Date.now(), title: intervention.title, message: intervention.message, href: intervention.href, actionLabel: intervention.action_label });
          }
          // Keep the notification engine deterministic and server-side, but throttle
          // refreshes because several financial tables can emit in the same burst.
          void refreshNotifications();
        });
      });
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("[nexo-live] realtime channel error");
      });
    };
    void setup();
    return () => {
      cancelled = true;
      if (timer.current) window.clearTimeout(timer.current);
      if (armTimer !== null) window.clearTimeout(armTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  if (!prompt) return null;
  return (
    <div className="fixed inset-x-3 bottom-[148px] z-[55] sm:left-auto sm:right-6 sm:bottom-24 sm:w-[390px]" role="status" aria-live="polite">
      <div className="overflow-hidden rounded-2xl border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3 p-4">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><p className="text-sm font-bold">{prompt.title}</p><span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"><BellRing className="h-3 w-3" /> en direct</span></div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{prompt.message}</p>
            <div className="mt-3 flex gap-2">
              <Link href={prompt.href} onClick={() => setPrompt(null)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground">{prompt.actionLabel ?? "Regarder"} <ChevronRight className="h-4 w-4" /></Link>
              <button type="button" onClick={() => setPrompt(null)} className="inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 text-xs font-semibold hover:bg-accent"><Check className="h-4 w-4" />Vu</button>
            </div>
          </div>
          <button type="button" aria-label="Fermer" onClick={() => setPrompt(null)} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
