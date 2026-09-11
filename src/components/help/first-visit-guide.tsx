"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, X } from "lucide-react";

const VERSION = "v1";

export default function FirstVisitGuide({ userId }: { userId: string }) {
  const storageKey = `nexora:first-visit-guide:${VERSION}:${userId}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) !== "seen");
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  const close = () => {
    try { localStorage.setItem(storageKey, "seen"); } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="nexora-first-visit-title">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border bg-card shadow-2xl">
        <div className="relative border-b p-6 sm:p-8">
          <button type="button" onClick={close} aria-label="Fermer le guide" className="absolute right-4 top-4 rounded-xl p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-start gap-4 pr-8">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="h-6 w-6" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Première visite</p>
              <h2 id="nexora-first-visit-title" className="mt-1 text-2xl font-black sm:text-3xl">Bienvenue sur NEXORA 👋</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Pas besoin de connaître la finance. On va simplement te montrer comment commencer.</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="grid gap-3">
            {[
              ["1", "Regarde", "Commence par ton tableau de bord : ce qui entre, ce qui sort et ce qui reste."],
              ["2", "Comprends", "Regarde tes dépenses et tes revenus. Tu n'as pas besoin de tout analyser d'un coup."],
              ["3", "Organise", "Utilise le budget pour te donner un repère simple."],
              ["4", "Demande", "Si tu ne comprends pas quelque chose, demande simplement à LIA."],
            ].map(([number, title, text]) => (
              <div key={number} className="flex gap-3 rounded-2xl border bg-background/40 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-black text-primary">{number}</span>
                <div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
            <p className="font-bold">🧠 Une seule règle pour commencer :</p>
            <p className="mt-1 text-muted-foreground">Tu n'as pas besoin de tout comprendre aujourd'hui. Avance étape par étape.</p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={close} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold hover:bg-accent">
              <Check className="h-4 w-4" /> J'ai compris
            </button>
            <Link href="/aide#demarrage" onClick={close} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
              Me guider pas à pas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
