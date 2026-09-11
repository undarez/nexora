import { redirect } from 'next/navigation';
import { Building2, CreditCard, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export default async function AdminOpenBankingPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/');
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) redirect('/');
  const admin = getSupabaseAdmin();
  if (!admin) return <main className="mx-auto max-w-7xl px-6 py-8"><p className="text-sm text-muted-foreground">Console indisponible : secret serveur Supabase non configuré.</p></main>;
  const [cR,aR,tR,wR] = await Promise.all([
    admin.from('bank_connections').select('id,user_id,provider,status,institution_name,last_synced_at,next_sync_at,consent_expires_at,reconnect_due_at,error_code,error_message,workspace_id,created_at').order('created_at',{ascending:false}).limit(500),
    admin.from('bank_accounts').select('id,user_id,connection_id,name,account_type,iban_masked,currency,balance,available_balance,last_synced_at,status,workspace_id').order('created_at',{ascending:false}).limit(1000),
    admin.from('bank_transactions').select('id,user_id,connection_id,account_id,booked_at,amount,currency,category,pending').order('booked_at',{ascending:false}).limit(1000),
    admin.from('financial_workspaces').select('id,name,workspace_type,status,owner_user_id').eq('workspace_type','business').order('created_at',{ascending:false}).limit(200),
  ]);
  const errors=[cR.error,aR.error,tR.error,wR.error].filter(Boolean);
  if(errors.length) return <main className="mx-auto max-w-7xl space-y-4 px-6 py-8"><h1 className="text-3xl font-bold">Open Banking</h1><div className="rounded-2xl border p-5 text-sm"><b>Lecture impossible.</b><p className="mt-1 text-muted-foreground">Applique les migrations Open Banking du projet puis recharge.</p><pre className="mt-3 text-xs">{errors.map((e:any)=>e?.message).join('\n')}</pre></div></main>;
  const connections=cR.data??[], accounts=aR.data??[], transactions=tR.data??[], workspaces=wR.data??[];
  const statusCount=(s:string)=>connections.filter(c=>c.status===s).length;
  const money=(n:unknown,c='EUR')=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:c}).format(Number(n??0));
  return <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
    <div><p className="text-sm font-semibold text-primary">Administration · Open Banking</p><h1 className="text-3xl font-bold">Accès et supervision bancaire</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Vue interne réservée à l'administration : connexions, comptes, synchronisations et échéances de reconnexion, sans secrets bancaires.</p></div>
    <div className="grid gap-4 md:grid-cols-4"><Metric icon={<RefreshCw className="h-5 w-5"/>} label="Connexions" value={String(connections.length)}/><Metric icon={<CreditCard className="h-5 w-5"/>} label="Comptes" value={String(accounts.length)}/><Metric icon={<Database className="h-5 w-5"/>} label="Transactions observées" value={String(transactions.length)}/><Metric icon={<Building2 className="h-5 w-5"/>} label="Espaces entreprise" value={String(workspaces.length)}/></div>
    <div className="grid gap-4 md:grid-cols-4">{['active','needs_reauth','error','revoked'].map(s=><Card key={s}><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{s.replace('_',' ')}</p><p className="mt-1 text-2xl font-bold">{statusCount(s)}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Connexions Open Banking</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="pb-3">Banque / fournisseur</th><th className="pb-3">Utilisateur</th><th className="pb-3">Portée</th><th className="pb-3">Statut</th><th className="pb-3">Dernière sync</th><th className="pb-3">Reconnexion</th><th className="pb-3">Erreur</th></tr></thead><tbody>{connections.map((c,i)=><tr key={c.id||`${c.provider}-${c.user_id}-${i}`} className="border-b last:border-0"><td className="py-3"><b>{c.institution_name||'Institution inconnue'}</b><div className="text-xs text-muted-foreground">{c.provider}</div></td><td className="py-3 font-mono text-xs">{c.user_id}</td><td className="py-3">{c.workspace_id?'Entreprise':'Personnel'}</td><td className="py-3">{c.status}</td><td className="py-3">{c.last_synced_at?new Date(c.last_synced_at).toLocaleString('fr-FR'):'—'}</td><td className="py-3">{c.reconnect_due_at?new Date(c.reconnect_due_at).toLocaleDateString('fr-FR'):'—'}</td><td className="max-w-[220px] truncate py-3 text-xs text-muted-foreground">{c.error_code||c.error_message||'—'}</td></tr>)}</tbody></table></div>{!connections.length&&<p className="text-sm text-muted-foreground">Aucune connexion enregistrée.</p>}</CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Comptes exposés à NEXORA</CardTitle></CardHeader><CardContent className="space-y-2">{accounts.slice(0,12).map((a,i)=><div key={a.id||`${a.connection_id}-${i}`} className="flex items-center justify-between rounded-xl border p-3"><div><b>{a.name}</b><p className="text-xs text-muted-foreground">{a.account_type} · {a.iban_masked||'IBAN masqué indisponible'} · {a.status||'active'}</p></div><b>{money(a.balance,a.currency||'EUR')}</b></div>)}{!accounts.length&&<p className="text-sm text-muted-foreground">Aucun compte.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Garde-fous</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>🔐 Aucun token, secret ou payload fournisseur brut n'est affiché.</p><p>⏱️ La politique NEXORA de reconnexion à 90 jours est visible via <b>reconnect_due_at</b>.</p><p>🛑 Les connexions <b>needs_reauth</b> ou révoquées ne doivent plus synchroniser.</p><p>🏢 Une connexion entreprise peut être utilisée par un employé autorisé, sans exiger que l'utilisateur soit le dirigeant.</p></CardContent></Card></div>
  </main>;
}
function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <Card><CardContent className="p-5"><div className="text-primary">{icon}</div><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>}
