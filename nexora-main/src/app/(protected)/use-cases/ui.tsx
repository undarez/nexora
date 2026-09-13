"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function UseCasesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lia/use-cases?limit=20", { cache: "no-store" })
      .then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Erreur"); return data; })
      .then((data) => setItems(data.useCases ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Impossible de charger les Use Cases."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6">
      <section className="mb-6 rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/15 p-3"><BrainCircuit className="h-7 w-7 text-primary" /></div>
          <div>
            <Badge>Intelligence LIA</Badge>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Use Cases</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Les Use Cases décrivent <strong>pourquoi</strong> et <strong>quand</strong> LIA mobilise ses skills et ses outils. Ils structurent l’orchestration sans jamais accorder de permission.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[['Objectif','Ce que LIA cherche à accomplir'],['Compétences','Les skills nécessaires pour raisonner et agir'],['Gouvernance','Risque, autonomie et vérification']].map(([title,text]) => <div key={title} className="rounded-2xl border bg-background/80 p-4"><p className="font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>)}
        </div>
      </section>

      {loading && <Card className="p-6 text-sm text-muted-foreground">Chargement des Use Cases…</Card>}
      {error && <Card className="border-destructive/30 p-6 text-sm text-destructive">{error}</Card>}
      {!loading && !error && <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => <Card key={item.use_case_id} className="overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{item.category}</p><h2 className="mt-1 text-lg font-bold">{item.name}</h2></div><Badge variant="secondary">v{item.version}</Badge></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
          <div className="mt-4 space-y-3 text-sm"><div><p className="font-semibold">Objectif</p><p className="text-muted-foreground">{item.objective}</p></div><div><p className="font-semibold">Déclencheur</p><p className="text-muted-foreground">{item.trigger}</p></div></div>
          <div className="mt-5 flex flex-wrap gap-2"><Badge variant="outline">Risque : {item.risk_class}</Badge><Badge variant="outline">Autonomie min. : L{item.minimum_autonomy}</Badge>{item.human_approval_required && <Badge variant="outline"><ShieldCheck className="mr-1 h-3 w-3" /> Validation humaine</Badge>}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Skills</p><ul className="space-y-1 text-xs">{(item.required_skills ?? []).map((x: string, index: number) => <li key={`${x || "skill"}-${index}`}>• {x}</li>)}</ul></div><div><p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Vérification</p><ul className="space-y-1 text-xs text-muted-foreground">{(item.verification_rules ?? []).slice(0,3).map((x: string, index: number) => <li key={`${x || "rule"}-${index}`}>• {x}</li>)}</ul></div></div>
        </Card>)}
      </div>}
    </main>
  );
}
