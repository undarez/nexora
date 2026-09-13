 "use client";

import { useEffect, useState } from "react";
import { MessageCircle, Settings2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import {
  DEFAULT_MASCOT_ID,
  getMascot,
  MASCOT_ENABLED_KEY,
  MASCOT_ID_KEY,
} from "@/lib/mascot/mascot-data";

const SETTINGS_EVENT = "gerer-finance:mascot-settings";

export function FinancialMascot() {
  const [enabled, setEnabled] = useState(true);
  const [mascotId, setMascotId] = useState(DEFAULT_MASCOT_ID);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("Bonjour ! Je peux t'aider à piloter ton budget.");

  useEffect(() => {
    const read = () => {
      const storedEnabled = window.localStorage.getItem(MASCOT_ENABLED_KEY);
      const storedId = window.localStorage.getItem(MASCOT_ID_KEY);
      setEnabled(storedEnabled !== "false");
      setMascotId(storedId || DEFAULT_MASCOT_ID);
    };
    read();
    window.addEventListener(SETTINGS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const mascot = getMascot(mascotId);

  if (!enabled) return null;

  const say = (text: string) => {
    setMessage(text);
    setOpen(true);
  };

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)] sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 rounded-2xl border bg-card text-card-foreground p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1 text-xs font-semibold text-blue-600">
                <Sparkles className="h-3.5 w-3.5" />
                Conseiller financier
              </p>
              <p className="mt-1 text-sm font-medium text-card-foreground">{message}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="rounded-full p-1 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => say("Je peux analyser tes dépenses et t'expliquer les écarts.")}
              className="rounded-lg border px-2 py-2 text-xs font-medium hover:bg-accent"
            >
              Analyser
            </button>
            <button
              type="button"
              onClick={() => say("Teste un achat dans le simulateur pour voir son impact avant de décider.")}
              className="rounded-lg border px-2 py-2 text-xs font-medium hover:bg-accent"
            >
              Tester un achat
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end justify-end gap-2">
        <div className="rounded-2xl border bg-card text-card-foreground px-3 py-2 shadow-lg">
          <p className="text-xs font-bold text-foreground">{mascot.name}</p>
          <p className="text-[11px] text-muted-foreground">{mascot.role}</p>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => say("Je suis là. Dis-moi ce que tu veux tester.")}
              className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-2 py-1 text-[11px]"
            >
              <MessageCircle className="h-3 w-3" /> Parler
            </button>
            <Link
              href="/settings#mascotte"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
            >
              <Settings2 className="h-3 w-3" /> Choisir
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => say(`Je suis ${mascot.name}. ${mascot.role}.`)}
          className="mascot-float relative h-24 w-20 overflow-hidden rounded-2xl border bg-card shadow-xl transition hover:scale-105 sm:h-32 sm:w-28"
          aria-label={`Ouvrir ${mascot.name}`}
        >
          <img
            src={mascot.image}
            alt={mascot.name}
            className="h-full w-full object-contain object-bottom"
          />
        </button>
      </div>
    </aside>
  );
}
