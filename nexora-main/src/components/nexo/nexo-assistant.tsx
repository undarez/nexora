"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, ChevronDown, Lightbulb, MessageCircle, Send, Settings2, ShieldCheck, Sparkles, X, CheckCircle2, AlertTriangle, RotateCcw, Target, CircleDot, Volume2, Square } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DEFAULT_MASCOT_ID, getMascot, MASCOT_ENABLED_KEY, MASCOT_ID_KEY } from "@/lib/mascot/mascot-data";

type Insight = { id: string; title: string; message: string; actionLabel: string; actionHref: string; tone: "info" | "warning" | "success" };
type ChatMessage = { role: "user" | "assistant"; content: string };
type ResearchInfo = { requested: boolean; provider?: string | null; status?: string; evidenceCount?: number; corroboratedClaims?: number; contradictions?: number; minimumEvidenceMet?: boolean; nextAction?: string; sources?: Array<{ title?: string; url?: string; tier?: string; confidence?: number }> };
type GoalState = { goalId: string; state: string; progress: number; currentStep: string; nextAction: string; completedSteps: string[]; blockers: string[]; completedAt: string | null };
type RecentGoal = GoalState & { loopRunId: string; objective: string; resumable: boolean; createdAt: string };
type CognitiveTimelineItem = { key: string; label: string; status: string; createdAt: string | null; durationMs: number | null };
type SessionTurn = { id: string; turn_index: number; loop_run_id: string | null; question: string; answer_preview: string | null; loop_status: string; goal_state: string | null; progress: number; decision: string | null; created_at: string };
type CognitiveLiveState = { session: { id: string; status: string; turnCount: number; updatedAt: string; context?: Record<string, unknown> }; goal: GoalState & { objective?: string } | null; run?: { id: string; status: string; createdAt: string; completedAt: string | null }; timeline: CognitiveTimelineItem[]; evidenceCount: number; sessionTimeline?: SessionTurn[]; lastUpdatedAt: string };
type ActionProposal = { id:string; action_key:string; title:string; description:string; risk_class:string; autonomy_level:number; reversible:boolean; status:string; expires_at:string|null; created_at:string };
type ImpactPreview = { generatedAt:string; actionKey:string; riskClass:string; reversible:boolean; financialMutation:boolean; summary:string; impacts:Array<{label:string;value:string;direction:string}>; assumptions:string[]; warnings:string[]; checks:string[] };
type Explainability = { confidence: "high" | "medium" | "low"; confidenceScore: number; evidence: Array<{ id: string; label: string; value: string; source: string; state: string; confidence: string }>; assumptions: string[]; limitations: string[]; checks: string[]; nextAction: string };

function buildInsights(pathname: string): Insight[] {
  if (pathname.startsWith("/budget")) return [
    { id: "budget", title: "Je surveille votre budget", message: "Je peux repérer une enveloppe qui dérive ou tester une hypothèse avec vous.", actionLabel: "Voir les prévisions", actionHref: "/previsions", tone: "info" },
    { id: "expense", title: "Ajouter une dépense ?", message: "Ajoutez-la sans quitter votre budget.", actionLabel: "Ajouter", actionHref: "/transactions?quick=expense", tone: "info" },
  ];
  if (pathname.startsWith("/transactions")) return [
    { id: "recurring", title: "Je regarde vos habitudes", message: "Les opérations répétitives peuvent devenir des charges récurrentes après votre validation.", actionLabel: "Voir le budget", actionHref: "/budget", tone: "info" },
    { id: "analysis", title: "Une analyse ?", message: "Je peux expliquer vos dépenses et les anomalies visibles.", actionLabel: "Faire le point", actionHref: "/pilotage", tone: "success" },
  ];
  if (pathname.startsWith("/previsions")) return [{ id: "forecast", title: "Je compare prévu et réel", message: "Les écarts peuvent améliorer les prochaines hypothèses, sans modifier vos données automatiquement.", actionLabel: "Voir le pilotage", actionHref: "/pilotage", tone: "info" }];
  if (pathname.startsWith("/pilotage")) return [{ id: "point", title: "Je peux faire le point avec vous", message: "Je rassemble budget, transactions, prévisions, objectifs et alertes avant de proposer des actions.", actionLabel: "Parler à Nexo", actionHref: "#nexo-chat", tone: "success" }];
  return [{ id: "welcome", title: "Je surveille les changements importants", message: "Je vous préviens lorsqu'un point mérite votre attention. Vous gardez toujours la main.", actionLabel: "Faire le point", actionHref: "/pilotage", tone: "success" }];
}

export function NexoAssistant() {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [autonomousBusy, setAutonomousBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pathname, setPathname] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [mascotId, setMascotId] = useState(DEFAULT_MASCOT_ID);
  const [explainability, setExplainability] = useState<Explainability | null>(null);
  const [research, setResearch] = useState<ResearchInfo | null>(null);
  const [goal, setGoal] = useState<GoalState | null>(null);
  const [recentGoals, setRecentGoals] = useState<RecentGoal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [resumeLoopRunId, setResumeLoopRunId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [liveState, setLiveState] = useState<CognitiveLiveState | null>(null);
  const [liveStateOpen, setLiveStateOpen] = useState(true);
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [impactPreviews, setImpactPreviews] = useState<Record<string, ImpactPreview | null>>({});
  const [previewBusy, setPreviewBusy] = useState<Record<string, boolean>>({});
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceAudio, setVoiceAudio] = useState<HTMLAudioElement | null>(null);


  useEffect(() => {
    setPathname(window.location.pathname);
    const timer = window.setTimeout(() => setOpen(true), 4200);
    const readMascot = () => {
      setEnabled(window.localStorage.getItem(MASCOT_ENABLED_KEY) !== "false");
      setMascotId(window.localStorage.getItem(MASCOT_ID_KEY) || DEFAULT_MASCOT_ID);
    };
    readMascot();
    void loadRecentGoals();
    void loadCognitiveSession();
    window.addEventListener("storage", readMascot);
    window.addEventListener("gerer-finance:mascot-settings", readMascot);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", readMascot); window.removeEventListener("gerer-finance:mascot-settings", readMascot); };
  }, []);

  const mascot = getMascot(mascotId);
  const insights = useMemo(() => buildInsights(pathname), [pathname]);
  const current = insights[0];

  async function speak(text: string) {
    if (!text.trim() || voiceBusy) return;
    if (voiceAudio) {
      voiceAudio.pause();
      voiceAudio.currentTime = 0;
      setVoiceAudio(null);
    }
    setVoiceBusy(true);
    try {
      const response = await fetch("/api/lia/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          provider: undefined,
          style: "Voix chaleureuse, claire, naturelle, française, avec un débit conversationnel.",
        }),
      });
      if (!response.ok) throw new Error("Synthèse vocale indisponible.");
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        setVoiceAudio(null);
        setVoiceBusy(false);
      };
      setVoiceAudio(audio);
      await audio.play();
    } catch (error) {
      console.warn("Voix Nexo indisponible:", error);
      setVoiceBusy(false);
    }
  }

  async function loadProposals() {
    try {
      const response = await fetch("/api/lia/actions", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setProposals(Array.isArray(data.proposals) ? data.proposals.filter((p: ActionProposal) => p.status === "proposed") : []);
    } catch {}
  }

  async function loadImpactPreview(id: string) {
    setPreviewBusy(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/lia/actions/impact-preview?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setImpactPreviews(prev => ({ ...prev, [id]: data.preview || null }));
    } finally { setPreviewBusy(prev => ({ ...prev, [id]: false })); }
  }

  async function decideProposal(id: string, decision: "approved" | "rejected") {
    const response = await fetch("/api/lia/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
    if (response.ok) await loadProposals();
  }

  async function loadRecentGoals() {
    setLoadingGoals(true);
    try {
      const response = await fetch("/api/lia/goals/recent", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setRecentGoals(Array.isArray(data.goals) ? data.goals : []);
    } finally { setLoadingGoals(false); }
  }


  async function loadCognitiveSession() {
    try {
      const response = await fetch("/api/lia/sessions", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const active = Array.isArray(data.sessions) ? data.sessions.find((item: any) => item.status === "active") : null;
      if (active?.id) setSessionId(active.id);
    } catch {}
  }

  async function loadLiveState(id = sessionId) {
    if (!id) return;
    try {
      const response = await fetch(`/api/lia/sessions/state?sessionId=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) return;
      setLiveState(await response.json());
    } catch {}
  }

  useEffect(() => {
    if (!sessionId || !open || !chat) return;
    void loadLiveState(sessionId);
    const timer = window.setInterval(() => void loadLiveState(sessionId), busy ? 1200 : 3000);
    return () => window.clearInterval(timer);
  }, [sessionId, open, chat, busy]);

  const liveProgress = liveState?.goal?.progress ?? 0;
  const liveCurrent = liveState?.timeline?.find(item => item.status === "current") ?? null;

  async function ask(loopRunId?: string | null) {
    const text = question.trim().slice(0, 2000);
    if (!text || busy) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setQuestion("");
    setBusy(true);
    try {
      const response = await fetch("/api/lia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          task: "financial_analysis",
          history: nextMessages.slice(-8),
          ...(sessionId ? { sessionId } : {}),
          ...(loopRunId ? { loopRunId } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "LIA n'a pas pu répondre.");
      setMessages(prev => [...prev, { role: "assistant", content: data.analysis || "Je n'ai pas reçu de réponse exploitable." }]);
      if (data.session?.id) setSessionId(data.session.id);
      setExplainability(data.explainability || null);
      setResearch(data.research || null);
      setGoal(data.goal || null);
      if (data.session?.id) void loadLiveState(data.session.id);
      if (data.goal?.goalId) setResumeLoopRunId(data.goal.state === "completed" ? null : (data.session?.activeLoopRunId || data.goal.goalId));
      void loadRecentGoals();

      // Once the conversational response is produced, give the bounded
      // deterministic runner a chance to perform read-only verification.
      // This makes the autonomous work visible in Nexo without granting the
      // model any financial write authority.
      const activeLoopRunId = data.session?.activeLoopRunId || data.goal?.goalId;
      if (activeLoopRunId && data.goal && !["completed", "failed", "blocked", "needs_human"].includes(data.goal.state)) {
        setAutonomousBusy(true);
        try {
          const runnerResponse = await fetch("/api/lia/goals/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ loopRunId: activeLoopRunId, maxSteps: 3 }),
          });
          const runnerData = await runnerResponse.json().catch(() => null);
          if (runnerResponse.ok && runnerData?.runner) {
            setGoal((prev) => prev ? { ...prev, state: runnerData.runner.status, progress: runnerData.runner.progress, currentStep: runnerData.runner.status === "completed" ? "completed" : prev.currentStep, nextAction: runnerData.runner.nextAction } : prev);
          }
        } finally {
          setAutonomousBusy(false);
          if (data.session?.id) void loadLiveState(data.session.id);
          void loadRecentGoals();
        }
      }
      void loadCognitiveSession();
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: error instanceof Error ? error.message : "LIA est momentanément indisponible." }]);
    } finally { setBusy(false); }
  }

  if (dismissed || !enabled) return null;

  return <div className="nexo-assistant-shell fixed bottom-[82px] right-4 z-50 md:bottom-6 md:right-6" aria-live="polite">
    {open && <div id="nexo-chat" className="nexo-chat-panel mb-3 w-[min(94vw,430px)] overflow-hidden rounded-[1.5rem] border bg-card text-card-foreground shadow-2xl animate-in">
      <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border bg-background shadow-sm">
            <img src={mascot.image} alt={mascot.name} className="h-full w-full object-contain object-bottom" />
          </div>
          <div className="min-w-0"><p className="flex items-center gap-1 font-bold"><BrainCircuit className="h-4 w-4 text-primary" />Nexo</p><p className="truncate text-[11px] text-muted-foreground">{mascot.name} · {mascot.role}</p></div>
        </div>
        <div className="flex items-center gap-1"><button aria-label="Réduire Nexo" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-accent"><ChevronDown className="h-4 w-4" /></button><button aria-label="Fermer Nexo" onClick={() => setDismissed(true)} className="rounded-lg p-2 hover:bg-accent"><X className="h-4 w-4" /></button></div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-end gap-3">
          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-2xl border bg-background shadow-sm">
            <img src={mascot.image} alt="" className="h-full w-full object-contain object-bottom" />
          </div>
          <div className={cn("rounded-2xl rounded-bl-md border p-3", current.tone === "warning" && "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20", current.tone === "success" && "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20")}>
            <div className="flex gap-2"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm font-semibold">{current.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{current.message}</p><a href={current.actionHref} onClick={() => { if (current.actionHref.startsWith("#")) setChat(true); }} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">{current.actionLabel}<ArrowRight className="h-3.5 w-3.5" /></a></div></div>
          </div>
        </div>

        {messages.length > 0 && <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={cn("flex gap-2", message.role === "user" ? "justify-end" : "items-end")}>
            {message.role === "assistant" && <div className="h-8 w-7 shrink-0 overflow-hidden rounded-lg border bg-background"><img src={mascot.image} alt="" className="h-full w-full object-contain" /></div>}
            <div className="flex max-w-[88%] items-end gap-1.5">
              <div className={cn("whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-xs leading-5", message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted")}>{message.content}</div>
              {message.role === "assistant" && <button type="button" onClick={() => { if (voiceAudio) { voiceAudio.pause(); voiceAudio.currentTime = 0; setVoiceAudio(null); setVoiceBusy(false); } else void speak(message.content); }} className="rounded-lg border bg-background p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50" aria-label={voiceAudio ? "Arrêter la voix" : "Écouter la réponse"} disabled={voiceBusy && !voiceAudio}>
                {voiceAudio ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>}
            </div>
          </div>)}
          {busy && <div className="flex items-end gap-2"><div className="h-8 w-7 overflow-hidden rounded-lg border bg-background"><img src={mascot.image} alt="" className="h-full w-full object-contain" /></div><div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-xs text-muted-foreground">Nexo vérifie les éléments…</div></div>}
        </div>}

        {autonomousBusy && <div className="rounded-2xl border border-primary/20 bg-primary/[0.045] p-3 shadow-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="h-10 w-9 shrink-0 overflow-hidden rounded-xl border bg-background"><img src={mascot.image} alt="" className="h-full w-full object-contain" /></div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-xs font-bold"><Sparkles className="h-3.5 w-3.5 text-primary" /> Nexo travaille sur l'objectif</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Lecture, observation et vérification déterministes en cours…</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/5 animate-pulse rounded-full bg-primary" /></div>
            </div>
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Gouverné côté serveur" />
          </div>
        </div>}

        {goal && messages.some(m => m.role === "assistant") && <div className="rounded-2xl border bg-primary/[0.035] p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><Target className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">Objectif LIA</p><span className="text-[10px] font-bold text-primary">{goal.progress}%</span></div>
              <p className="mt-1 truncate text-[10px] text-muted-foreground">{goal.currentStep} · {goal.nextAction}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, goal.progress))}%` }} /></div>
              <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground"><span>{goal.completedSteps.length} étape(s) validée(s)</span><span>{goal.blockers.length ? `${goal.blockers.length} blocage(s)` : "aucun blocage"}</span></div>
            </div>
          </div>
        </div>}

        {chat && liveState?.goal && <details open={liveStateOpen} onToggle={e => setLiveStateOpen((e.currentTarget as HTMLDetailsElement).open)} className="rounded-2xl border bg-primary/[0.03] p-3">
          <summary className="cursor-pointer list-none text-xs font-bold">🧠 État cognitif · {Math.round(liveProgress)}% {liveCurrent ? `· ${liveCurrent.label}` : ""}</summary>
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border bg-background/70 p-3">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Objectif</p><p className="mt-1 text-xs font-bold leading-4">{liveState.goal.objective || "Objectif actif"}</p></div><span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{Math.round(liveProgress)}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, liveProgress))}%` }} /></div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-muted-foreground"><span>{liveCurrent ? `Étape : ${liveCurrent.label}` : liveState.goal.currentStep}</span><span>{liveState.evidenceCount} preuve(s)</span></div>
            </div>
            <div className="grid gap-1.5">
              {liveState.timeline.map((item, index) => <div key={`${item.key || "timeline"}-${index}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px]">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full border", item.status === "completed" && "border-primary bg-primary", item.status === "current" && "border-primary bg-primary/30 ring-2 ring-primary/20", item.status === "pending" && "border-muted-foreground/30", item.status === "failed" && "border-destructive bg-destructive/60", item.status === "blocked" && "border-amber-500 bg-amber-500/60", item.status === "needs_human" && "border-amber-500 bg-amber-500/60")} />
                <span className={cn("min-w-0 flex-1", item.status === "current" ? "font-bold text-foreground" : "text-muted-foreground")}>{item.label}</span>
                <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">{item.status === "completed" ? "OK" : item.status === "current" ? "EN COURS" : item.status === "pending" ? "À VENIR" : item.status}</span>
              </div>)}
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-background/70 p-2.5 text-[10px]">
              <span className="flex min-w-0 items-center gap-1.5"><Target className="h-3.5 w-3.5 shrink-0 text-primary" />{liveState.goal.nextAction}</span>
              <span className="shrink-0 text-muted-foreground">{liveState.goal.blockers.length ? `${liveState.goal.blockers.length} blocage(s)` : "aucun blocage"}</span>
            </div>
            <p className="text-[9px] text-muted-foreground">État actualisé automatiquement · {liveState.session.turnCount} échange(s)</p>
            {liveState.sessionTimeline && liveState.sessionTimeline.length > 0 && <details className="rounded-xl border bg-background/70 p-2.5">
              <summary className="cursor-pointer list-none text-[10px] font-bold">🕘 Historique de la session · {liveState.sessionTimeline.length} tour(s)</summary>
              <div className="mt-2 space-y-2">
                {liveState.sessionTimeline.slice(-6).reverse().map(turn => <div key={turn.id} className="rounded-lg border bg-muted/20 p-2">
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground"><span className="font-bold text-foreground">Tour {turn.turn_index}</span><span>{turn.goal_state || turn.loop_status}</span><span className="ml-auto">{turn.progress}%</span></div>
                  <p className="mt-1 text-[10px] font-semibold leading-4">{turn.question}</p>
                  {turn.answer_preview && <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-muted-foreground">{turn.answer_preview}</p>}
                </div>)}
              </div>
            </details>}
          </div>
        </details>}

        {recentGoals.some(item => item.resumable) && <details className="rounded-2xl border bg-muted/20 p-3">
          <summary className="cursor-pointer list-none text-xs font-bold"><RotateCcw className="mr-1 inline h-3.5 w-3.5" />Reprendre un objectif</summary>
          <div className="mt-2 space-y-2">
            {recentGoals.filter(item => item.resumable).slice(0, 3).map((item, index) => <button key={`${item.loopRunId || "goal"}-${index}`} type="button" onClick={() => { setResumeLoopRunId(item.loopRunId); setChat(true); setQuestion(""); }} className="w-full rounded-xl border bg-background/70 p-2.5 text-left hover:bg-accent">
              <div className="flex items-center gap-2"><CircleDot className="h-3.5 w-3.5 text-primary" /><span className="min-w-0 flex-1 truncate text-[10px] font-semibold">{item.objective}</span><span className="text-[9px] font-bold text-primary">{item.progress}%</span></div>
              <p className="mt-1 truncate pl-5 text-[9px] text-muted-foreground">{item.currentStep} · {item.nextAction}</p>
            </button>)}
          </div>
        </details>}

        {proposals.length > 0 && <details open className="rounded-2xl border border-amber-300/60 bg-amber-50/40 p-3 dark:bg-amber-950/10">
          <summary className="cursor-pointer list-none text-xs font-bold">🟠 Actions en attente de votre validation · {proposals.length}</summary>
          <div className="mt-3 space-y-2">
            {proposals.slice(0,3).map(p => <div key={p.id} className="rounded-xl border bg-background/80 p-3">
              <p className="text-xs font-bold">{p.title}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{p.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]"><span className="rounded-full bg-muted px-2 py-1">{p.risk_class}</span><span className="rounded-full bg-muted px-2 py-1">autonomie {p.autonomy_level}/8</span>{p.reversible && <span className="rounded-full bg-muted px-2 py-1">réversible</span>}</div>
              <div className="mt-3 rounded-xl border bg-muted/20 p-2.5">{impactPreviews[p.id] ? <div className="space-y-2 text-[10px]"><p className="font-semibold">📊 Aperçu de l’impact</p><p className="text-muted-foreground">{impactPreviews[p.id]?.summary}</p><div className="grid gap-1.5 sm:grid-cols-2">{impactPreviews[p.id]?.impacts.map((x,i)=><div key={`${x.label}-${i}`} className="rounded-lg border bg-background/70 p-2"><span className="text-muted-foreground">{x.label}</span><span className="ml-2 font-bold">{x.value}</span></div>)}</div>{(impactPreviews[p.id]?.warnings || []).map((x,i)=><p key={`${x || "warning"}-${i}`} className="text-amber-700 dark:text-amber-300">⚠️ {x}</p>)}</div> : <button type="button" disabled={previewBusy[p.id]} onClick={() => void loadImpactPreview(p.id)} className="w-full rounded-lg border px-3 py-2 text-[10px] font-bold">{previewBusy[p.id] ? "Calcul de l’aperçu…" : "📊 Voir l’impact avant décision"}</button>}</div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void decideProposal(p.id,"rejected")} className="rounded-xl border px-3 py-2 text-xs font-bold">Refuser</button><button type="button" disabled={!impactPreviews[p.id]} onClick={() => void decideProposal(p.id,"approved")} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">Autoriser</button></div>
              <p className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground"><ShieldCheck className="h-3 w-3" /> L'autorisation humaine précède toute exécution.</p>
            </div>)}
          </div>
        </details>}

        {research?.requested && messages.some(m => m.role === "assistant") && <details className="rounded-2xl border bg-muted/20 p-3">
          <summary className="cursor-pointer list-none text-xs font-bold">🌐 Recherche externe · {research.evidenceCount ?? 0} preuve(s) · {research.minimumEvidenceMet ? "suffisante" : "insuffisante"}</summary>
          <div className="mt-3 space-y-2 text-[10px] text-muted-foreground">
            <p>Fournisseur : <span className="font-semibold text-foreground">{research.provider || "non configuré"}</span> · corroborations : {research.corroboratedClaims ?? 0} · contradictions : {research.contradictions ?? 0}</p>
            {research.sources?.slice(0, 5).map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl border bg-background/70 p-2 hover:bg-accent"><p className="font-semibold text-foreground">{source.title || source.url}</p><p>{source.tier} · confiance {source.confidence ?? 0}%</p></a>)}
            {research.nextAction && <p className="rounded-xl border bg-background/70 p-2">{research.nextAction}</p>}
          </div>
        </details>}

        {explainability && messages.some(m => m.role === "assistant") && <details className="rounded-2xl border bg-muted/20 p-3">
          <summary className="cursor-pointer list-none text-xs font-bold">🔎 Pourquoi cette réponse ? · confiance {explainability.confidenceScore}%</summary>
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">{explainability.evidence.slice(0, 6).map(item => <div key={item.id} className="rounded-xl border bg-background/70 p-2.5"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p><p className="mt-1 text-xs font-bold">{item.value}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.source} · {item.state}</p></div>)}</div>
            {explainability.limitations.length > 0 && <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-2.5 dark:bg-amber-950/20"><div className="flex items-center gap-2 text-xs font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Limites</div><ul className="mt-1 space-y-1 text-[10px] text-muted-foreground">{explainability.limitations.map((x, i) => <li key={`${x || "limitation"}-${i}`}>• {x}</li>)}</ul></div>}
            <div className="flex items-start gap-2 rounded-xl border bg-background/70 p-2.5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><p className="text-[10px] leading-4 text-muted-foreground">{explainability.nextAction}</p></div>
          </div>
        </details>}

        {!chat ? <button type="button" onClick={() => setChat(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-95"><MessageCircle className="h-4 w-4" />Parler à Nexo</button> : <div className="space-y-2">
          <div className="flex gap-2">{resumeLoopRunId && <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-primary"><RotateCcw className="h-3 w-3" />Mode reprise d’objectif activé</div>}<input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { const loop = resumeLoopRunId; setResumeLoopRunId(null); void ask(loop); } }} placeholder="Ex. Que dois-je surveiller ?" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" disabled={busy} /><button type="button" disabled={busy || !question.trim()} onClick={() => { const loop = resumeLoopRunId; setResumeLoopRunId(null); void ask(loop); }} className="rounded-xl bg-primary px-3 text-primary-foreground disabled:opacity-50" aria-label="Envoyer"><Send className="h-4 w-4" /></button></div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Données et actions restent gouvernées côté serveur.</span><Link href="/settings#mascotte" className="inline-flex items-center gap-1 font-semibold hover:underline"><Settings2 className="h-3 w-3" />Mascotte</Link></div>
        </div>}
      </div>
    </div>}

    {!open && <button type="button" onClick={() => setOpen(true)} className="nexo-launcher group relative flex items-center gap-2 rounded-[1.35rem] border bg-card/95 p-2 text-card-foreground shadow-2xl backdrop-blur-xl" aria-label="Ouvrir Nexo">
      <div className="nexo-launcher-mascot h-16 w-14 shrink-0 overflow-hidden rounded-[1rem] border bg-background shadow-sm transition group-hover:scale-105 sm:h-20 sm:w-16">
        <img src={mascot.image} alt={mascot.name} className="h-full w-full object-contain object-bottom" />
      </div>
      <div className="pr-3 text-left"><p className="flex items-center gap-1 text-xs font-extrabold"><BrainCircuit className="h-3.5 w-3.5 text-primary" />Nexo</p><p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">Votre copilote financier</p><span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary">Ouvrir <ArrowRight className="h-3 w-3" /></span></div>
    </button>}
  </div>;
}
