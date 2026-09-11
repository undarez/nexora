 "use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";

const STORAGE_KEY = "nexora-guided-start-v1";

const steps = [
  {
    title: "Regarde ta situation",
    text: "Commence par ton tableau de bord. Cherche seulement 3 choses : ce qui entre, ce qui sort et ce qui reste.",
    link: "/dashboard",
    action: "Voir mon tableau de bord",
  },
  {
    title: "Comprends tes dépenses",
    text: "Ouvre tes transactions et regarde les dépenses importantes. Tu n'as pas besoin de tout analyser d'un coup.",
    link: "/transactions",
    action: "Voir mes transactions",
  },
  {
    title: "Organise ton argent",
    text: "Regarde ton budget. Un budget n'est pas une punition : c'est simplement un repère pour savoir où tu en es.",
    link: "/budget",
    action: "Voir mon budget",
  },
  {
    title: "Pose une question à LIA",
    text: "Tu peux écrire comme tu parles. Demande une explication, une analyse ou plusieurs solutions.",
    link: "/lia",
    action: "Parler à LIA",
  },
  {
    title: "Prends le temps de décider",
    text: "Lis les explications et vérifie les informations importantes. Une recommandation de LIA est une proposition : la décision reste la tienne.",
    link: "/aide#securite",
    action: "Voir les bonnes pratiques",
  },
];

export default function GuidedStart() {
  const [completed, setCompleted] = useState<boolean[]>(() => steps.map(() => false));

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(saved) && saved.length === steps.length) setCompleted(saved.map(Boolean));
    } catch {}
  }, []);

  const done = useMemo(() => completed.filter(Boolean).length, [completed]);
  const progress = Math.round((done / steps.length) * 100);

  const toggle = (index: number) => {
    const next = completed.map((value, i) => (i === index ? !value : value));
    setCompleted(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const reset = () => {
    const next = steps.map(() => false);
    setCompleted(next);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return (
    <section id="demarrage" className="scroll-mt-28 py-8">
      <div className="overflow-hidden rounded-[2rem] border bg-card shadow-sm">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="rounded-2xl bg-primary/10 p-3 text-primary"><Sparkles className="h-6 w-6" /></span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Parcours guidé</p>
                <h2 className="mt-1 text-2xl font-black sm:text-3xl">🌱 Tes premiers pas avec NEXORA</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Tu débutes ? Fais simplement ces 5 étapes. Tu peux t'arrêter et revenir plus tard.
                </p>
              </div>
            </div>
            <button type="button" onClick={reset} className="inline-flex items-center gap-2 self-start rounded-xl border px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-accent">
              <RotateCcw className="h-3.5 w-3.5" /> Recommencer
            </button>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>{done}/5 étapes terminées</span><span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {steps.map((step, index) => (
              <div key={step.title} className={`rounded-2xl border p-4 transition ${completed[index] ? "border-primary/30 bg-primary/5" : "bg-background/40"}`}>
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => toggle(index)} aria-label={completed[index] ? `Marquer ${step.title} comme non terminé` : `Marquer ${step.title} comme terminé`}
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${completed[index] ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>
                    {completed[index] ? <Check className="h-4 w-4" /> : <span className="text-xs font-black">{index + 1}</span>}
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-bold ${completed[index] ? "line-through opacity-70" : ""}`}>{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
                    <Link href={step.link} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                      {step.action} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {done === steps.length && (
            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6">
              <strong>🎉 Bravo !</strong> Tu as terminé le parcours de départ. Maintenant, utilise NEXORA à ton rythme. Il n'est pas nécessaire de tout connaître pour bien commencer.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
