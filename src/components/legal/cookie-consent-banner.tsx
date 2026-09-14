"use client";

import { useEffect, useState } from "react";
import { Cookie, Settings2, ShieldCheck } from "lucide-react";

const KEY = "nexora-privacy-preferences-v1";
const COOKIE = "nexora_cookie_consent";
const MAX_AGE = 60 * 60 * 24 * 180;

type Preferences = { optional: boolean; savedAt: string };

function readStored(): Preferences | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Preferences;
  } catch {}
  try {
    const match = document.cookie.split("; ").find((part) => part.startsWith(`${COOKIE}=`));
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match.slice(COOKIE.length + 1))) as Preferences;
  } catch { return null; }
}

function persist(optional: boolean) {
  const prefs: Preferences = { optional, savedAt: new Date().toISOString() };
  try { window.localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(prefs))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax; Secure`;
  window.dispatchEvent(new CustomEvent("nexora:privacy-preferences", { detail: prefs }));
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);
  const [optional, setOptional] = useState(false);

  useEffect(() => {
    const current = readStored();
    if (current) setOptional(Boolean(current.optional));
    else setVisible(true);
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<Preferences>).detail;
      if (detail) { setOptional(Boolean(detail.optional)); setVisible(false); }
    };
    window.addEventListener("nexora:privacy-preferences", onChange);
    return () => window.removeEventListener("nexora:privacy-preferences", onChange);
  }, []);

  const save = (value: boolean) => { persist(value); setOptional(value); setVisible(false); setDetails(false); };

  if (!visible) return <button type="button" onClick={() => setVisible(true)} aria-label="Gérer mes cookies" className="fixed bottom-4 left-4 z-[80] grid h-11 w-11 place-items-center rounded-full border bg-background shadow-lg hover:bg-accent"><Cookie className="h-5 w-5" /></button>;

  return <div className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-3xl rounded-3xl border bg-card p-5 shadow-2xl sm:inset-x-auto sm:left-5 sm:right-5 sm:p-6" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Cookie className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="cookie-consent-title" className="font-bold">Votre confidentialité compte</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">NEXORA utilise des mécanismes strictement nécessaires à l’authentification, à la sécurité et au fonctionnement du service. Aucun traceur publicitaire ou de suivi optionnel n’est actuellement activé.</p>
        {details && <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-2xl border bg-background p-3"><p className="font-semibold">Nécessaires · toujours actifs</p><p className="mt-1 text-muted-foreground">Session, authentification, sécurité et mémorisation de votre choix.</p></div><div className="rounded-2xl border bg-background p-3"><p className="font-semibold">Optionnels · désactivés</p><p className="mt-1 text-muted-foreground">Audience non exemptée, personnalisation ou marketing. Aucun de ces traceurs n’est actuellement déployé.</p></div></div>}
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setDetails(v => !v)} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"><Settings2 className="h-3.5 w-3.5" />{details ? "Masquer les détails" : "Personnaliser"}</button><button type="button" onClick={() => save(false)} className="rounded-xl border px-4 py-2 text-xs font-bold">Tout refuser</button><button type="button" onClick={() => save(true)} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Tout accepter</button></div>
        {details && <div className="mt-3 flex items-center justify-between rounded-2xl border p-3"><div><p className="text-xs font-semibold">Traceurs optionnels</p><p className="text-[11px] text-muted-foreground">Aucun service optionnel n’est actuellement activé par ce choix.</p></div><button type="button" role="switch" aria-checked={optional} onClick={() => setOptional(v => !v)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${optional ? "bg-primary text-primary-foreground" : "border"}`}>{optional ? "Autorisés" : "Refusés"}</button></div>}
        {details && <button type="button" onClick={() => save(optional)} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary"><ShieldCheck className="h-3.5 w-3.5" />Enregistrer mes choix</button>}
      </div>
    </div>
  </div>;
}
