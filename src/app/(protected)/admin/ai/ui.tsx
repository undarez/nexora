"use client";

import { useEffect, useState } from 'react';
import { Activity, Bot, Cpu, Gauge, Lightbulb, Send, ShieldCheck, Workflow } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Message = { role: 'admin' | 'ai'; content: string };
type Runtime = { sampleSize: number; latency: { p50Ms: number | null; p95Ms: number | null; maxMs: number | null }; generatedTokens: number; estimatedCostCents: number; providers: Array<{ provider: string; requests: number; avgLatencyMs: number | null; tokens: number; estimatedCostCents: number }>; };
type Overview = { totalRuns: number; errors: number; agents: Array<{ agent: string; runs: number; errors: number; errorRate: number; avgDurationMs: number }>; services: { ollama: boolean }; localAi: { model: string; enabled: boolean; context: number }; controlPlane: { mode: string; jobs: number; activeJobs: number; runningJobs: number; recentEvents: number; lastEventAt: string | null } };

export default function AdminAIClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', content: 'Bonjour. Je suis le copilote IA de l’administration. Je peux analyser la santé de Gérer Finance et proposer des améliorations. Je ne modifie jamais le produit sans validation humaine.' }]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<{ title: string; description: string; priority: string } | null>(null);
  const [proposalSaved, setProposalSaved] = useState(false);

  const refresh = async () => {
    const r = await fetch('/api/admin/ai/overview', { cache: 'no-store' });
    if (r.ok) setOverview(await r.json());
    const rr = await fetch('/api/admin/lia/production-runtime', { cache: 'no-store' });
    if (rr.ok) setRuntime(await rr.json());
  };
  useEffect(() => { void refresh(); const id = window.setInterval(() => void refresh(), 15000); return () => window.clearInterval(id); }, []);

  const send = async () => {
    const q = question.trim(); if (!q || loading) return;
    setQuestion(''); setMessages((m) => [...m, { role: 'admin', content: q }]); setLoading(true);
    try {
      const r = await fetch('/api/admin/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Erreur IA');
      setMessages((m) => [...m, { role: 'ai', content: `${data.analysis}${data.provider ? `\\n\\n— Moteur : ${data.provider === 'ollama' ? 'IA locale · Ollama' : data.provider}` : ''}` }]);
    } catch (e) { setMessages((m) => [...m, { role: 'ai', content: e instanceof Error ? e.message : 'Impossible de contacter l’IA.' }]); }
    finally { setLoading(false); }
  };


  const saveProposal = async () => {
    if (!proposal) return;
    const r = await fetch('/api/admin/ai/proposals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proposal) });
    if (r.ok) { setProposalSaved(true); setTimeout(() => setProposalSaved(false), 2500); }
  };

  return <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
    <div><p className="text-sm font-semibold text-primary">Administration · IA</p><h1 className="text-3xl font-bold">Salle de contrôle IA</h1><p className="mt-2 text-sm text-muted-foreground">Une console interne pour comprendre le comportement de l'intelligence, surveiller ses services et décider des évolutions du produit.</p></div>
    <div className="grid gap-4 md:grid-cols-5">
      <Card><CardContent className="p-5"><Activity className="h-5 w-5 text-emerald-500" /><p className="mt-3 text-xs text-muted-foreground">Exécutions · 24 h</p><p className="text-2xl font-bold">{overview?.totalRuns ?? '—'}</p></CardContent></Card>
      <Card><CardContent className="p-5"><ShieldCheck className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Erreurs · 24 h</p><p className="text-2xl font-bold">{overview?.errors ?? '—'}</p></CardContent></Card>
      <Card><CardContent className="p-5"><Workflow className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Control Plane NEXORA</p><p className="text-2xl font-bold">{overview?.controlPlane.activeJobs ?? '—'}</p><p className="mt-1 text-xs text-muted-foreground">{overview?.controlPlane.runningJobs ?? 0} en cours · {overview?.controlPlane.jobs ?? 0} jobs</p></CardContent></Card>
      <Card><CardContent className="p-5"><Cpu className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">IA locale</p><p className="text-2xl font-bold">{overview ? (overview.services.ollama ? 'Opérationnelle' : 'Hors ligne') : '—'}</p><p className="mt-1 text-xs text-muted-foreground">{overview?.localAi.model ?? 'Ollama'} · {overview?.localAi.context ? `${Math.round(overview.localAi.context / 1024)}K` : '—'}</p></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Comportement des agents · 24 h</CardTitle></CardHeader><CardContent>{overview?.agents.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Agent</th><th className="p-2">Runs</th><th className="p-2">Erreurs</th><th className="p-2">Taux erreur</th><th className="p-2">Durée moyenne</th></tr></thead><tbody>{overview.agents.map((a) => <tr key={a.agent} className="border-b last:border-0"><td className="p-2 font-medium">{a.agent}</td><td className="p-2">{a.runs}</td><td className="p-2">{a.errors}</td><td className="p-2">{Math.round(a.errorRate * 100)} %</td><td className="p-2">{a.avgDurationMs ? `${a.avgDurationMs} ms` : '—'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">Aucune exécution enregistrée sur les dernières 24 heures.</p>}</CardContent></Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" />NEXORA Control Plane</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Mode</p><p className="mt-1 font-semibold">Natif NEXORA</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Jobs actifs</p><p className="mt-1 font-semibold">{overview?.controlPlane.activeJobs ?? '—'}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Jobs en cours</p><p className="mt-1 font-semibold">{overview?.controlPlane.runningJobs ?? '—'}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Dernier événement</p><p className="mt-1 font-semibold">{overview?.controlPlane.lastEventAt ? new Date(overview.controlPlane.lastEventAt).toLocaleString('fr-FR') : '—'}</p></div>
        <p className="sm:col-span-2 lg:col-span-4 text-xs leading-5 text-muted-foreground">Le control plane interne remplace la dépendance à un orchestrateur externe : LIA pilote ses jobs, leurs états, leurs événements et leurs garde-fous depuis les données natives de NEXORA.</p>
      </CardContent>
    </Card>

    <div className="grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Discussion temps réel avec Nexo</CardTitle></CardHeader><CardContent><div className="max-h-[520px] space-y-4 overflow-y-auto rounded-xl border bg-muted/30 p-4">{messages.map((m, i) => <div key={i} className={m.role === 'admin' ? 'ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground' : 'max-w-[90%] rounded-2xl border bg-card px-4 py-3 text-sm'}>{m.content}</div>)}</div><div className="mt-4 flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} placeholder="Ex. Qu'est-ce qu'on devrait améliorer cette semaine ?" className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" /><Button onClick={() => void send()} disabled={loading || !question.trim()}><Send className="mr-2 h-4 w-4" />{loading ? 'Analyse…' : 'Envoyer'}</Button></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" />Gouvernance</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><p className="text-muted-foreground">Une idée proposée par l'IA doit rester une décision humaine avant de devenir une mission du Control Plane NEXORA.</p><Button variant="outline" className="w-full" onClick={() => setProposal({ title: 'Amélioration proposée par l’IA', description: 'Décrire ici la proposition issue de l’analyse de Nexo.', priority: 'medium' })}>Préparer une proposition</Button>{proposal && <div className="space-y-3 rounded-xl border p-3"><input value={proposal.title} onChange={(e) => setProposal({ ...proposal, title: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" /><textarea value={proposal.description} onChange={(e) => setProposal({ ...proposal, description: e.target.value })} className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm" /><select value={proposal.priority} onChange={(e) => setProposal({ ...proposal, priority: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm"><option value="low">Faible</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="critical">Critique</option></select><Button className="w-full" onClick={() => void saveProposal()}>{proposalSaved ? 'Proposition enregistrée' : 'Enregistrer pour validation'}</Button></div>}</CardContent></Card>
    </div>
  </main>;
}
