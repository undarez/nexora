"use client";

import { useEffect, useState } from "react";

const KEY = "nexora-privacy-preferences-v1";

type Preferences = { optional: boolean; savedAt: string };

export function PrivacyControls() {
  const [open, setOpen] = useState(false);
  const [optional, setOptional] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setOptional(Boolean((JSON.parse(raw) as Preferences).optional));
    } catch {}
  }, []);

  const save = (value: boolean) => {
    const prefs: Preferences = { optional: value, savedAt: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
    setOptional(value);
    setSaved(true);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("nexora:privacy-preferences", { detail: prefs }));
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="underline-offset-4 hover:underline">Préférences de confidentialité</button>
      {open && <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-dialog-title">
        <div className="w-full max-w-lg rounded-3xl border bg-background p-6 shadow-2xl">
          <h2 id="privacy-dialog-title" className="text-xl font-bold">Préférences de confidentialité</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">NEXORA n’active actuellement aucun traceur publicitaire ou de suivi tiers non nécessaire. Les mécanismes strictement nécessaires au fonctionnement et à la sécurité peuvent être utilisés sans consentement lorsqu’ils sont exemptés par la réglementation.</p>
          <div className="mt-5 rounded-2xl border p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">Traceurs optionnels</p><p className="text-xs text-muted-foreground">Mesure d’audience non strictement nécessaire, personnalisation ou marketing — actuellement désactivés par défaut.</p></div><button type="button" role="switch" aria-checked={optional} onClick={() => setOptional(v => !v)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${optional ? "bg-primary text-primary-foreground" : "border"}`}>{optional ? "Activés" : "Désactivés"}</button></div></div>
          <p className="mt-4 text-xs text-muted-foreground">Votre choix est mémorisé localement. Lorsqu’un traceur optionnel sera réellement déployé, il ne pourra être activé qu’après un consentement conforme.</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Annuler</button><button type="button" onClick={() => save(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Tout refuser</button><button type="button" onClick={() => save(optional)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Enregistrer</button></div>
        </div>
      </div>}
      {saved && <span className="sr-only" role="status">Préférences enregistrées.</span>}
    </>
  );
}
