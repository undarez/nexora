"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, BrainCircuit, CheckCircle2, CircleHelp, LockKeyhole, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const examples = [
  "Puis-je me permettre cet achat ?",
  "Fais le point sur mon mois",
  "Détecte une dérive de dépenses",
  "Simule cette décision financière",
];

export default function OrchestrationPage() {
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [execution, setExecution] = useState<any>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/lia/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: goal }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de construire le plan.");
      setResult(data);
      setExecution(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  const governance = result?.governance;
  const useCase = result?.useCase;
  const candidateUseCase = result?.candidateUseCase;
  const skills = result?.skills ?? [];
  const steps = result?.steps ?? [];
  const executionByStep = new Map<number, any>((execution?.trace ?? []).filter((item: any) => Number.isFinite(Number(item?.step))).map((item: any) => [Number(item.step), item]));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6">
      <section className="rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-primary/15 p-3"><BrainCircuit className="h-7 w-7 text-primary" /></div>
          <div>
            <Badge>Centre d’orchestration</Badge>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Donnez un objectif à LIA</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              LIA recherche d’abord les scénarios et Skills connus. Si aucun scénario ne correspond, elle construit une procédure candidate bornée, apprend de l’issue et la soumet à la gouvernance. Cette étape ne déclenche aucune action financière.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            maxLength={600}
            placeholder="Ex. Est-ce que je peux acheter cette moto sans fragiliser mon budget ?"
            className="h-12 flex-1 rounded-2xl bg-background"
          />
          <Button disabled={loading || goal.trim().length < 3} className="h-12 rounded-2xl px-5">
            {loading ? "Analyse…" : "Construire le plan"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => setGoal(example)} className="rounded-full border bg-background/80 px-3 py-2 text-xs font-medium hover:bg-accent">
              {example}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Search, title: "1 · Comprendre", description: "Recherche des scénarios et compétences déjà validés." },
          { icon: Sparkles, title: "2 · Composer", description: "Relie Use Case, Skills et outils sans créer de permission." },
          { icon: ShieldCheck, title: "3 · Gouverner", description: "Le Policy Engine reste l’autorité avant toute action." },
        ].map(({ icon: Icon, title, description }) => (
          <Card key={title} className="p-5">
            <Icon className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </Card>
        ))}
      </div>

      {error && <Card className="mt-5 border-destructive/30 p-5 text-sm text-destructive">{error}</Card>}

      {result && (
        <section className="mt-5 space-y-4">
          <section className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
            <Card className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Use Case identifié</p>
                  <h2 className="mt-1 text-xl font-bold">{useCase?.name ?? candidateUseCase?.name ?? "Construction en cours"}</h2>
                </div>
                {useCase && <Badge variant="secondary">v{useCase.version}</Badge>}
              </div>

              {useCase ? (
                <>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{useCase.description}</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Objectif</p>
                      <p className="mt-1 text-sm">{useCase.objective}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Déclencheur</p>
                      <p className="mt-1 text-sm">{useCase.trigger}</p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skills retenus</p>
                    {skills.length ? (
                      <div className="flex flex-wrap gap-2">
                        {skills.map((skill: any, index: number) => <Badge key={`${skill.skill_id || skill.slug || "skill"}-${index}`} variant="outline">{skill.name}</Badge>)}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucun skill actif correspondant n’est disponible.</p>
                    )}
                  </div>
                  <div className="mt-6 rounded-2xl border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" />Vérifications prévues</div>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {(useCase.verification_rules ?? []).map((rule: string, index: number) => <li key={`${rule || "rule"}-${index}`}>• {rule}</li>)}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-5">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-sm font-semibold">LIA construit un scénario candidat.</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Aucun scénario validé n’a été trouvé. LIA ne s’arrête plus : elle construit une procédure bornée, la soumet à la gouvernance et l’utilise uniquement comme proposition jusqu’à validation.</p>
                  {candidateUseCase && <div className="mt-3 rounded-xl border bg-background/70 p-3 text-xs"><p className="font-semibold">{candidateUseCase.objective}</p><p className="mt-1 text-muted-foreground">Déclencheur : {candidateUseCase.trigger} · validation humaine requise</p></div>}
                </div>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Gouvernance</p>
              <div className="mt-4 space-y-4">
                <div className="flex justify-between gap-3"><span className="text-sm">Risque</span><Badge variant="outline">{governance?.riskClass ?? "—"}</Badge></div>
                <div className="flex justify-between gap-3"><span className="text-sm">Autonomie minimale</span><Badge variant="outline">L{governance?.minimumAutonomy ?? "—"}</Badge></div>
                <div className="flex justify-between gap-3"><span className="text-sm">Validation humaine</span><Badge variant="outline">{governance?.humanApprovalRequired ? "Requise" : "Non requise"}</Badge></div>
                <div className="rounded-2xl bg-primary/10 p-4">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-sm font-semibold">Exécution : proposition uniquement</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Le Policy Engine et les garde-fous restent obligatoires au moment d’agir.</p>
                </div>
              </div>
            </Card>
          </section>

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Étapes gouvernées</p>
                <h2 className="mt-1 text-lg font-bold">Plan borné · {result.plan?.status ?? "planned"}</h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{steps.length} étape{steps.length > 1 ? "s" : ""}</Badge>
                {result?.run?.id && (
                  <Button type="button" size="sm" disabled={running || result.plan?.status === "blocked"} onClick={async () => {
                    setRunning(true);
                    setError("");
                    try {
                      const response = await fetch("/api/lia/orchestrate/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run_id: result.run.id, max_steps: 5 }), cache: "no-store" });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error || "Exécution impossible.");
                      setExecution(data);
                    } catch (caught) {
                      setError(caught instanceof Error ? caught.message : "Exécution impossible.");
                    } finally { setRunning(false); }
                  }}>
                    {running ? "LIA exécute…" : "▶ Exécuter le plan"}
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {steps.map((step: any) => (
                <div key={step.index} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{step.index}. {step.procedure}</p>
                    <Badge variant={(executionByStep.get(step.index)?.status ?? step.status) === "blocked" || (executionByStep.get(step.index)?.status ?? step.status) === "failed" ? "destructive" : "outline"}>{executionByStep.get(step.index)?.status ?? step.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Risque : {step.risk_class} · {step.human_gate_required ? "Validation humaine" : "Observation/proposition"}</p>
                </div>
              ))}
            </div>
            {execution && (
              <div className="mt-5 rounded-2xl border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Runtime LIA</p>
                    <p className="mt-1 text-sm font-semibold">Statut : {execution.status} · {execution.stepsExecuted} étape{execution.stepsExecuted > 1 ? "s" : ""} exécutée{execution.stepsExecuted > 1 ? "s" : ""}</p>
                  </div>
                  {execution.nextStep && <Badge variant="outline">Prochaine : étape {execution.nextStep}</Badge>}
                  {(execution.trace ?? []).some((item: any) => item?.output?.replan?.replanned) && (
                    <Badge variant="secondary">↻ Replanification gouvernée</Badge>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {(execution.trace ?? []).map((item: any, index: number) => (
                    <div key={`${item.step ?? "x"}-${index}`} className="rounded-xl border bg-background p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-semibold">Étape {item.step ?? "—"}</span> · {item.procedure ?? "—"} · <span className="font-medium">{item.status}</span>
                      </div>
                      {item.output && (
                        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-2 text-[11px] leading-5 text-muted-foreground">{JSON.stringify(item.output, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">L'exécution est bornée : lecture/analyse autonome autorisée, écriture financière sensible toujours protégée par le Human Gate.</p>
              </div>
            )}
          </Card>
        </section>
      )}
    </main>
  );
}
