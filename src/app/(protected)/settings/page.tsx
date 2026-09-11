 "use client";

import { useEffect, useState } from "react";
import { Check, Power, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CORE_RULES } from "@/lib/agents/supervisor";
import {
  DEFAULT_MASCOT_ID,
  MASCOTS,
  MASCOT_ENABLED_KEY,
  MASCOT_ID_KEY,
} from "@/lib/mascot/mascot-data";

const SETTINGS_EVENT = "gerer-finance:mascot-settings";

function broadcast() {
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export default function Page() {
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState(DEFAULT_MASCOT_ID);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(MASCOT_ENABLED_KEY) !== "false");
    setSelected(window.localStorage.getItem(MASCOT_ID_KEY) || DEFAULT_MASCOT_ID);
  }, []);

  const toggleMascot = () => {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem(MASCOT_ENABLED_KEY, String(next));
    broadcast();
  };

  const chooseMascot = (id: string) => {
    setSelected(id);
    window.localStorage.setItem(MASCOT_ID_KEY, id);
    window.localStorage.setItem(MASCOT_ENABLED_KEY, "true");
    setEnabled(true);
    broadcast();
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold text-blue-600">Paramètres</p>
        <h1 className="text-3xl font-bold">Personnalisation & sécurité</h1>
        <p className="mt-2 text-sm text-slate-500">
          Configure ton conseiller visuel et consulte les règles qui encadrent ses recommandations.
        </p>
      </div>

      <Card id="mascotte" className="scroll-mt-24">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Mascotte du conseiller
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Choisis ton personnage à tout moment. La désactivation masque la mascotte sans désactiver le conseiller financier.
              </p>
            </div>

            <button
              type="button"
              onClick={toggleMascot}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                enabled
                  ? "bg-emerald-600 text-white"
                  : "border bg-white text-slate-700"
              }`}
              aria-pressed={enabled}
            >
              <Power className="h-4 w-4" />
              {enabled ? "Mascotte activée" : "Mascotte désactivée"}
            </button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {MASCOTS.map((mascot) => {
              const active = selected === mascot.id;
              return (
                <button
                  type="button"
                  key={mascot.id}
                  onClick={() => chooseMascot(mascot.id)}
                  className={`group relative overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                    active ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
                  }`}
                  aria-pressed={active}
                >
                  <div className="h-44 bg-slate-950">
                    <img
                      src={mascot.image}
                      alt={mascot.name}
                      className="h-full w-full object-contain object-bottom transition group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold">{mascot.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{mascot.role}</p>
                  </div>
                  {active && (
                    <span className="absolute right-2 top-2 rounded-full bg-blue-600 p-1.5 text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <strong>À quoi ça sert ?</strong> Cette partie règle uniquement l’apparence de Nexo, le compagnon visuel. Elle ne change ni le moteur de raisonnement de LIA, ni les données financières, ni les autorisations. Les règles ci-dessous sont les garde-fous appliqués par le superviseur.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Règles actives du superviseur</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {CORE_RULES.map((r) => (
            <div key={r.id} className="rounded-lg border p-4">
              <p className="font-semibold">{r.label}</p>
              <p className="mt-1 text-xs text-slate-500">{r.id}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
