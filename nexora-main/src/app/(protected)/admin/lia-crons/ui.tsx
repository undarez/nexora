'use client';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Pause, Play, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Job = { id:string; user_id:string; name:string; description:string; schedule:string|null; status:string; payload:any; next_run_at:string|null; last_run_at:string|null; last_status:string|null; requires_policy_gate:boolean; requires_human_approval:boolean; timezone:string; execution_mode:string; admin_disabled:boolean; admin_disabled_at:string|null; admin_disabled_reason:string|null; created_at:string; updated_at:string };
type Event = { id:string; user_id:string; runtime_job_id:string|null; event:string; status:string; payload:any; created_at:string };

function missionFor(job: Job) {
  switch (job.payload?.action) {
    case "autonomous_learning":
      return "Rechercher de nouvelles connaissances financières, réglementaires, de sécurité, de confidentialité ou de méthodologie, vérifier les informations avec des sources fiables, détecter les contradictions et n'accepter que les connaissances compatibles avec les garde-fous.";
    case "goal_watch":
      return "Surveiller les objectifs financiers de l'utilisateur, détecter les signaux utiles et déclencher une analyse proactive lorsque cela est pertinent.";
    default:
      return "Surveiller la situation financière de l'utilisateur, détecter les signaux importants et déclencher une analyse proactive sans effectuer de mouvement financier automatiquement.";
  }
}

export default function LiaCronAdminClient(){
  const [jobs,setJobs]=useState<Job[]>([]); const [events,setEvents]=useState<Event[]>([]); const [enabled,setEnabled]=useState(true); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState<string|null>(null); const [error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/admin/lia-crons',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error);setJobs(d.jobs||[]);setEvents(d.events||[]);setEnabled(d.control?.cron_autonomy_enabled!==false);}catch(e){setError(e instanceof Error?e.message:'Impossible de charger les Cron.')}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  const act=async(action:string,jobId?:string)=>{if(action==='delete'&&!confirm('Supprimer définitivement ce Cron LIA ?'))return;if(action==='global_disable'&&!confirm('Désactiver TOUS les Cron autonomes LIA ?'))return;setBusy(jobId||action);try{const r=await fetch('/api/admin/lia-crons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,jobId,reason:'Contrôle administrateur'})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load()}catch(e){setError(e instanceof Error?e.message:'Action impossible.')}finally{setBusy(null)}};
  const eventByJob=useMemo(()=>{const m=new Map<string,Event[]>();for(const e of events){if(!e.runtime_job_id)continue;const a=m.get(e.runtime_job_id)||[];a.push(e);m.set(e.runtime_job_id,a)}return m},[events]);
  return <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-semibold text-primary">Administration · Runtime LIA</p><h1 className="text-3xl font-bold">Centre de contrôle des Cron</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">LIA crée, ajuste et journalise ses Cron automatiquement. Cette console est réservée à l’administration pour suivre sa progression, ses réveils, ses réussites et intervenir si elle va trop loin.</p></div><div className="flex gap-2"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4"/>Actualiser</Button>{enabled?<Button variant="destructive" onClick={()=>void act('global_disable')} disabled={busy==='global_disable'}><ShieldAlert className="mr-2 h-4 w-4"/>Kill switch global</Button>:<Button onClick={()=>void act('global_enable')} disabled={busy==='global_enable'}><Play className="mr-2 h-4 w-4"/>Réactiver LIA</Button>}</div></div>
    {!enabled&&<div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm"><b>🔴 Kill switch actif.</b> Tous les Cron autonomes LIA sont suspendus. LIA ne peut pas réactiver cette autonomie elle-même.</div>}
    {error&&<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div>}
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm"><b>Progression LIA</b><p className="mt-1 text-xs leading-5 text-muted-foreground">Les Cron ne sont plus de simples horaires : chaque job possède un état, une prochaine exécution, une dernière exécution et un historique d’événements. Le Control Plane NEXORA pourra ensuite apprendre des résultats pour ajuster ses cadences.</p></div><div className="grid gap-4 md:grid-cols-4"><Card><CardContent className="p-5"><CalendarClock className="h-5 w-5 text-primary"/><p className="mt-3 text-xs text-muted-foreground">Cron LIA</p><p className="text-2xl font-bold">{jobs.length}</p></CardContent></Card><Card><CardContent className="p-5"><CheckCircle2 className="h-5 w-5 text-emerald-500"/><p className="mt-3 text-xs text-muted-foreground">Actifs</p><p className="text-2xl font-bold">{jobs.filter(j=>j.status==='ready'&&!j.admin_disabled).length}</p></CardContent></Card><Card><CardContent className="p-5"><Pause className="h-5 w-5"/><p className="mt-3 text-xs text-muted-foreground">Suspendus admin</p><p className="text-2xl font-bold">{jobs.filter(j=>j.admin_disabled).length}</p></CardContent></Card><Card><CardContent className="p-5"><AlertTriangle className="h-5 w-5 text-amber-500"/><p className="mt-3 text-xs text-muted-foreground">Événements</p><p className="text-2xl font-bold">{events.length}</p></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Cron créés par LIA</CardTitle></CardHeader><CardContent>{loading?<p className="text-sm text-muted-foreground">Chargement…</p>:jobs.length===0?<p className="text-sm text-muted-foreground">Aucun Cron autonome créé.</p>:<div className="space-y-4">{jobs.map(j=><div key={j.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{j.name}</span><span className="rounded-full border px-2 py-0.5 text-xs">{j.admin_disabled?'🔴 Bloqué admin':j.status==='ready'?'🟢 Actif':`⚪ ${j.status}`}</span><span className="rounded-full bg-muted px-2 py-0.5 text-xs">🤖 Créé par LIA</span></div><p className="mt-2 text-sm text-muted-foreground">{j.description}</p><div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><b>Cadence</b><br/>{j.schedule||'—'} · {j.timezone}</div><div><b>Prochaine exécution</b><br/>{j.next_run_at?new Date(j.next_run_at).toLocaleString('fr-FR'):'À calculer'}</div><div><b>Dernière exécution</b><br/>{j.last_run_at?new Date(j.last_run_at).toLocaleString('fr-FR'):'—'} · {j.last_status||'—'}</div><div><b>Garde</b><br/>{j.requires_policy_gate?'Policy Gate':'Aucune'} · {j.requires_human_approval?'Validation humaine':'Automatique'}</div></div>{j.admin_disabled_reason&&<p className="mt-3 text-xs text-destructive">Motif admin : {j.admin_disabled_reason}</p>}</div><div className="flex shrink-0 gap-2">{j.admin_disabled?<Button size="sm" onClick={()=>void act('enable',j.id)} disabled={busy===j.id}><Play className="mr-1 h-4 w-4"/>Réactiver</Button>:<Button size="sm" variant="outline" onClick={()=>void act('disable',j.id)} disabled={busy===j.id}><Pause className="mr-1 h-4 w-4"/>Suspendre</Button>}<Button size="sm" variant="destructive" onClick={()=>void act('delete',j.id)} disabled={busy===j.id}><Trash2 className="h-4 w-4"/></Button></div></div><details className="mt-4 rounded-xl border bg-muted/20 p-4">
  <summary className="cursor-pointer list-none font-semibold">🧠 Voir le contenu du Cron</summary>
  <div className="mt-4 grid gap-4 lg:grid-cols-2">
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mission de LIA</p>
      <p className="mt-2 text-sm leading-6">{missionFor(j)}</p>
    </div>
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action exécutée</p>
      <code className="mt-2 block rounded-lg bg-muted p-3 text-xs">{String(j.payload?.action || 'proactive_financial_watch')}</code>
      <p className="mt-3 text-xs text-muted-foreground">Mode : {j.execution_mode} · Garde : {j.requires_policy_gate ? 'Policy Gate' : 'Aucune'} · {j.requires_human_approval ? 'Validation humaine' : 'Sans validation humaine'}</p>
    </div>
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Règles / garde-fous</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>• Gestionnaire : {j.payload?.managed_by === 'lia' ? 'LIA' : 'runtime'}</li>
        <li>• Adaptatif : {j.payload?.adaptive ? 'oui' : 'non'}</li>
        <li>• Écritures financières : {j.payload?.financial_writes_allowed === true ? 'autorisées par le payload' : 'interdites'}</li>
        <li>• Domaines fiables uniquement : {j.payload?.trusted_domains_only ? 'oui' : 'non spécifié'}</li>
      </ul>
    </div>
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Déroulement</p>
      <ol className="mt-2 space-y-1 text-sm">
        {j.payload?.action==='autonomous_learning' ? <>
          <li>1. Déterminer un sujet de recherche.</li><li>2. Rechercher et acquérir des sources.</li><li>3. Évaluer la confiance et les contradictions.</li><li>4. Produire des connaissances candidates.</li><li>5. Accepter uniquement les éléments vérifiés.</li><li>6. Enregistrer le cycle et la mémoire d'apprentissage.</li>
        </> : <>
          <li>1. Charger le contexte financier.</li><li>2. Calculer les signaux de manière déterministe.</li><li>3. Prioriser les signaux utiles.</li><li>4. Générer une analyse proactive.</li><li>5. Journaliser le résultat et les observations.</li>
        </>}
      </ol>
    </div>
  </div>
  <div className="mt-4 rounded-xl border bg-background p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payload technique</p>
    <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-5">{JSON.stringify(j.payload ?? {}, null, 2)}</pre>
  </div>
</details>
<div className="mt-3 border-t pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historique récent</p><div className="space-y-1">{(eventByJob.get(j.id)||[]).slice(0,5).map(e=><div key={e.id} className="flex justify-between gap-3 text-xs"><span>{e.event} · {e.status}</span><span className="text-muted-foreground">{new Date(e.created_at).toLocaleString('fr-FR')}</span></div>)}{!(eventByJob.get(j.id)||[]).length&&<span className="text-xs text-muted-foreground">Aucun événement.</span>}</div></div></div>)}</div>}</CardContent></Card>
  </main>
}
