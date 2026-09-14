"use client";

import { useEffect, useState } from "react";

const KEY = "nexora-privacy-preferences-v1";
const COOKIE = "nexora_cookie_consent";
const MAX_AGE = 60 * 60 * 24 * 180;
type Preferences = { optional: boolean; savedAt: string };

function readPreferences(): Preferences | null {
  try { const raw = window.localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as Preferences; } catch {}
  try { const match = document.cookie.split("; ").find((part) => part.trim().startsWith(`${COOKIE}=`)); if (match) return JSON.parse(decodeURIComponent(match.trim().slice(COOKIE.length + 1))) as Preferences; } catch {}
  return null;
}

function persist(value: boolean) {
  const prefs: Preferences = { optional: value, savedAt: new Date().toISOString() };
  try { window.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax; Secure`;
  window.dispatchEvent(new CustomEvent("nexora:privacy-preferences", { detail: prefs }));
}

export function PrivacyControls() {
  const [open, setOpen] = useState(false);
  const [optional, setOptional] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const current = readPreferences();
    if (current) setOptional(Boolean(current.optional));
    const onChange = (event: Event) => { const detail = (event as CustomEvent<Preferences>).detail; if (detail) setOptional(Boolean(detail.optional)); };
    window.addEventListener("nexora:privacy-preferences", onChange);
    return () => window.removeEventListener("nexora:privacy-preferences", onChange);
  }, []);

  const save = (value: boolean) => { persist(value); setOptional(value); setSaved(true); setOpen(false); };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="underline-offset-4 hover:underline">Préférences de confidentialité</button>
    {open && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-dialog-title">
      <div className="w-full max-w-lg rounded-3xl border bg-background p-6 shadow-2xl">
        <h2 id="privacy-dialog-title" className="text-xl font-bold">Préférences de confidentialité</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Les mécanismes strictement nécessaires au fonctionnement, à l’authentification et à la sécurité restent actifs lorsqu’ils sont légalement exemptés. Aucun traceur publicitaire ou de suivi optionnel n’est actuellement déployé.</p>
        <div className="mt-5 rounded-2xl border p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">Traceurs optionnels</p><p className="text-xs text-muted-foreground">Audience non exemptée, personnalisation ou marketing. Actuellement : aucun service optionnel actif.</p></div><button type="button" role="switch" aria-checked={optional} onClick={() => setOptional(v => !v)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${optional ? "bg-primary text-primary-foreground" : "border"}`}>{optional ? "Autorisés" : "Refusés"}</button></div></div>
        <p className="mt-4 text-xs text-muted-foreground">Votre choix est conservé pendant 6 mois au maximum dans ce mécanisme et peut être modifié à tout moment. Le retrait est aussi simple que l’acceptation.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Annuler</button><button type="button" onClick={() => save(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Tout refuser</button><button type="button" onClick={() => save(optional)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Enregistrer</button></div>
      </div>
    </div>}
    {saved && <span className="sr-only" role="status">Préférences enregistrées.</span>}
  </>;
}
