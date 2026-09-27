import { redirect } from 'next/navigation';
import { Activity, Globe2, Mail, Monitor, Network, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

type ConnectionRow = { user_id: string; session_id: string; ip_address: string | null; user_agent: string | null; first_seen_at: string; last_seen_at: string };
type UserRow = { id: string; email?: string | null; created_at: string; last_sign_in_at?: string | null; sessions: number; active_days: number; frequency: number; last_connection: string | null; ip: string | null };

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const shortId = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;
const formatFrequency = (value: number) => `${value.toFixed(1)}/j`;

export default async function AdminConnectionsPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/');
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) redirect('/');
  const admin = getSupabaseAdmin();
  if (!admin) return <main className="mx-auto max-w-7xl px-6 py-8"><p className="text-sm text-muted-foreground">Vue indisponible : secret serveur non configuré.</p></main>;

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: connections, error: connectionError }, usersResult] = await Promise.all([
    admin.from('user_connection_events').select('user_id,session_id,ip_address,user_agent,first_seen_at,last_seen_at').gte('last_seen_at', since).order('last_seen_at', { ascending: false }).limit(50000),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (connectionError || usersResult.error) return <main className="mx-auto max-w-7xl space-y-4 px-6 py-8"><h1 className="text-2xl font-bold">Connexions utilisateurs</h1><p className="text-sm text-destructive">Impossible de charger les données d'administration.</p><p className="text-xs text-muted-foreground">Vérifie la migration des connexions et la présence du secret Supabase côté serveur.</p></main>;

  const rows = (connections ?? []) as ConnectionRow[];
  const byUser = new Map<string, ConnectionRow[]>();
  for (const row of rows) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  const users: UserRow[] = usersResult.data.users.map((u) => {
    const sessions = byUser.get(u.id) ?? [];
    const days = new Set(sessions.map((s) => new Date(s.last_seen_at).toISOString().slice(0, 10))).size;
    return { id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, sessions: sessions.length, active_days: days, frequency: sessions.length / 30, last_connection: sessions[0]?.last_seen_at ?? u.last_sign_in_at ?? null, ip: sessions[0]?.ip_address ?? null };
  }).sort((a, b) => (b.last_connection ?? '').localeCompare(a.last_connection ?? ''));

  const active = users.filter((u) => u.sessions > 0).length;
  const sessions = rows.length;
  const uniqueIps = new Set(rows.map((r) => r.ip_address).filter(Boolean)).size;

  return <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
    <div>
      <p className="text-sm font-semibold text-primary">Administration · Sécurité & usage</p>
      <h1 className="text-3xl font-bold">Connexions utilisateurs</h1>
      <p className="mt-2 max-w-4xl text-sm text-muted-foreground">Vue réservée aux administrateurs : identifiant utilisateur, adresse e-mail, IP technique de connexion, dernière activité et fréquence d'utilisation sur les 30 derniers jours.</p>
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <Metric icon={<Users className="h-5 w-5" />} label="Utilisateurs actifs · 30 j" value={String(active)} />
      <Metric icon={<Activity className="h-5 w-5" />} label="Sessions · 30 j" value={String(sessions)} />
      <Metric icon={<Network className="h-5 w-5" />} label="IP distinctes" value={String(uniqueIps)} />
      <Metric icon={<Monitor className="h-5 w-5" />} label="Utilisateurs inscrits" value={String(usersResult.data.users.length)} />
    </div>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" />Activité par utilisateur</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[980px] text-sm">
          <thead><tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground"><th className="px-4 py-3">Utilisateur</th><th className="px-4 py-3">ID</th><th className="px-4 py-3">IP récente</th><th className="px-4 py-3">Dernière connexion</th><th className="px-4 py-3">Sessions</th><th className="px-4 py-3">Jours actifs</th><th className="px-4 py-3">Fréquence</th><th className="px-4 py-3">Inscrit le</th></tr></thead>
          <tbody>{users.map((u) => <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20"><td className="px-4 py-3 font-medium"><span className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{u.email ?? '—'}</span></td><td className="px-4 py-3 font-mono text-xs" title={u.id}>{shortId(u.id)}</td><td className="px-4 py-3 font-mono text-xs">{u.ip ?? '—'}</td><td className="px-4 py-3">{u.last_connection ? dateFmt.format(new Date(u.last_connection)) : '—'}</td><td className="px-4 py-3">{u.sessions}</td><td className="px-4 py-3">{u.active_days}</td><td className="px-4 py-3">{formatFrequency(u.frequency)}</td><td className="px-4 py-3">{dateFmt.format(new Date(u.created_at))}</td></tr>)}</tbody>
        </table>
      </CardContent>
    </Card>

    <div className="rounded-xl border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground">
      <strong className="text-foreground">Confidentialité :</strong> l'adresse affichée ici est l'IP technique de connexion, pas une adresse postale. Aucune géolocalisation n'est déduite de l'IP. Les données de connexion sont conservées dans une table distincte protégée par RLS et ne sont accessibles qu'au serveur d'administration.
    </div>
  </main>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><CardContent className="p-5"><div className="text-primary">{icon}</div><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>;
}
