import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, Bot, CalendarClock, Settings, ShieldCheck, Users, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/auth/admin';

export default async function AdminPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/');
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) redirect('/');

  const [{ count: runs }, { count: errors }, { count: profiles }] = await Promise.all([
    supabase.from('agent_runs').select('*', { count: 'exact', head: true }),
    supabase.from('agent_runs').select('*', { count: 'exact', head: true }).eq('status', 'error'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ]);

  return <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
    <div><p className="text-sm font-semibold text-primary">Administration</p><h1 className="text-3xl font-bold">Centre de contrôle</h1><p className="mt-2 text-sm text-muted-foreground">Une vue réservée aux administrateurs pour piloter la santé du produit et de son intelligence.</p></div>
    <div className="grid gap-4 md:grid-cols-3">
      <Card><CardContent className="p-5"><Users className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Profils</p><p className="text-2xl font-bold">{profiles ?? 0}</p></CardContent></Card>
      <Card><CardContent className="p-5"><Activity className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Exécutions IA</p><p className="text-2xl font-bold">{runs ?? 0}</p></CardContent></Card>
      <Card><CardContent className="p-5"><ShieldCheck className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Erreurs enregistrées</p><p className="text-2xl font-bold">{errors ?? 0}</p></CardContent></Card>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Link href="/admin/ai"><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Admin IA</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Surveille les agents, le Control Plane NEXORA, les exécutions et discute avec l’intelligence du produit.</CardContent></Card></Link>
      <Link href="/admin/open-banking"><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Open Banking</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Connexions, comptes, synchronisations, statuts et échéances de reconnexion 90 jours.</CardContent></Link>
      <Link href="/admin/analytics"><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Analytics produit</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Trafic, utilisateurs actifs, sessions et modules les plus consultés. Vue strictement réservée à l’administration.</CardContent></Link>
      <Link href="/admin/lia-learning"><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Learning Review Board</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Revue humaine des améliorations candidates de LIA, replay et non-régression.</CardContent></Card></Link>
      <Link href="/admin/lia-crons"><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Cron autonomes LIA</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Voir tous les Cron créés par LIA, leur justification, leur historique et intervenir immédiatement si nécessaire.</CardContent></Card></Link>
      <Link href="/admin/system"><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" />Système</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Kill switch IA, recherche Internet, rafraîchissement bancaire, Cron autonomes et supervision du runtime.</CardContent></Card></Link>
    </div>
  </main>;
}