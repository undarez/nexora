import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, Bot, CalendarClock, Settings, ShieldCheck, Users, BarChart3, Globe2 } from 'lucide-react';
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

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold text-primary">Administration</p>
        <h1 className="text-3xl font-bold">Centre de contrôle</h1>
        <p className="mt-2 text-sm text-muted-foreground">Une vue réservée aux administrateurs pour piloter la santé du produit et de son intelligence.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><Users className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Profils</p><p className="text-2xl font-bold">{profiles ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><Activity className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Exécutions IA</p><p className="text-2xl font-bold">{runs ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-5"><ShieldCheck className="h-5 w-5 text-primary" /><p className="mt-3 text-xs text-muted-foreground">Erreurs enregistrées</p><p className="text-2xl font-bold">{errors ?? 0}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AdminLink href="/admin/ai" icon={<Bot className="h-5 w-5 text-primary" />} title="Admin IA">Surveille les agents, le Control Plane NEXORA, les exécutions et discute avec l’intelligence du produit.</AdminLink>
        <AdminLink href="/admin/open-banking" icon={<ShieldCheck className="h-5 w-5 text-primary" />} title="Open Banking">Connexions, comptes, synchronisations, statuts et échéances de reconnexion 90 jours.</AdminLink>
        <AdminLink href="/admin/connections" icon={<Globe2 className="h-5 w-5 text-primary" />} title="Connexions utilisateurs">Identifiants, IP techniques, dernières connexions, nombre de sessions, jours actifs et fréquence d'utilisation.</AdminLink>
        <AdminLink href="/admin/analytics" icon={<BarChart3 className="h-5 w-5 text-primary" />} title="Analytics produit">Trafic, utilisateurs actifs, sessions et modules les plus consultés. Vue strictement réservée à l’administration.</AdminLink>
        <AdminLink href="/admin/lia-learning" icon={<Bot className="h-5 w-5 text-primary" />} title="Learning Review Board">Revue humaine des améliorations candidates de LIA, replay et non-régression.</AdminLink>
        <AdminLink href="/admin/lia-crons" icon={<CalendarClock className="h-5 w-5 text-primary" />} title="Cron autonomes LIA">Voir tous les Cron créés par LIA, leur justification, leur historique et intervenir immédiatement si nécessaire.</AdminLink>
        <AdminLink href="/admin/system" icon={<Settings className="h-5 w-5 text-primary" />} title="Système">Kill switch IA, recherche Internet, rafraîchissement bancaire, Cron autonomes et supervision du runtime.</AdminLink>
      </div>
    </main>
  );
}

function AdminLink({ href, icon, title, children }: { href: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <Link href={href}><Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{children}</CardContent></Card></Link>;
}
