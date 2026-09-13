import { redirect } from 'next/navigation';
import { Activity, Clock3, Eye, Layers3, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/auth/admin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

function dayKey(date: Date) { return date.toISOString().slice(0, 10); }

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/');
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) redirect('/');
  const admin = getSupabaseAdmin();
  if (!admin) return <main className="mx-auto max-w-7xl px-6 py-8"><p className="text-sm text-muted-foreground">Analytics indisponibles : secret serveur non configuré.</p></main>;

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: events, error } = await admin.from('product_analytics_events').select('user_id,session_id,event_name,route,feature_key,occurred_at').gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(50000);
  if (error) return <main className="mx-auto max-w-7xl space-y-4 px-6 py-8"><p className="text-sm text-destructive">Impossible de charger les analytics.</p><div className="rounded-2xl border border-amber-300/50 bg-amber-50/60 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"><b>Base analytics non disponible.</b><p className="mt-1 text-xs leading-5">Vérifie que la migration product analytics est appliquée dans Supabase. L’interface ne considère pas cette absence comme une panne de NEXORA.</p></div></main>;

  const rows = events ?? [];
  const users = new Set(rows.map((r) => r.user_id));
  const sessions = new Set(rows.map((r) => r.session_id));
  const pageViews = rows.filter((r) => r.event_name === 'page_view').length;
  const activeDays = new Set(rows.map((r) => dayKey(new Date(r.occurred_at)))).size;
  const featureCounts = new Map<string, number>();
  for (const row of rows) if (row.event_name === 'feature_view' && row.feature_key) featureCounts.set(row.feature_key, (featureCounts.get(row.feature_key) ?? 0) + 1);
  const topFeatures = [...featureCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const recentUsers = [...new Set(rows.map((r) => r.user_id))].length;

  return <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
    <div><p className="text-sm font-semibold text-primary">Administration · Analytics produit</p><h1 className="text-3xl font-bold">Surveillance d’usage</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Vue strictement réservée à l’administration. NEXORA mesure uniquement l’usage produit nécessaire au pilotage : visites, sessions et modules consultés. Aucun montant financier ni contenu de page n’est enregistré.</p></div>
    <div className="grid gap-4 md:grid-cols-4">
      <Metric icon={<Users className="h-5 w-5" />} label="Utilisateurs actifs · 30 j" value={String(users.size)} />
      <Metric icon={<Activity className="h-5 w-5" />} label="Sessions · 30 j" value={String(sessions.size)} />
      <Metric icon={<Eye className="h-5 w-5" />} label="Pages vues · 30 j" value={String(pageViews)} />
      <Metric icon={<Clock3 className="h-5 w-5" />} label="Jours observés" value={String(activeDays)} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Layers3 className="h-5 w-5 text-primary" />Modules les plus utilisés</CardTitle></CardHeader><CardContent className="space-y-3">{topFeatures.length ? topFeatures.map(([name, count], index) => <div key={`${name || "feature"}-${index}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><span className="font-medium capitalize">{name}</span><span className="text-muted-foreground">{count} consultations</span></div>) : <p className="text-sm text-muted-foreground">Pas encore assez de données.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Lecture opérationnelle</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p><strong className="text-foreground">Utilisateurs actifs :</strong> utilisateurs ayant généré au moins un événement sur les 30 derniers jours.</p><p><strong className="text-foreground">Sessions :</strong> sessions locales anonymisées par identifiant aléatoire.</p><p><strong className="text-foreground">Modules :</strong> calculés à partir des routes applicatives, sans capturer les paramètres, requêtes ou données financières.</p><p><strong className="text-foreground">Rétention :</strong> cette première vue fournit le socle. L'étape suivante pourra ajouter J+1/J+7/J+30 et cohortes lorsque le volume d'usage le justifiera.</p><p className="rounded-xl border bg-muted/40 p-3">Période affichée : 30 derniers jours · échantillon maximal : 50 000 événements.</p></CardContent></Card>
    </div>
    <p className="text-xs text-muted-foreground">Base interne first-party, sans fournisseur d'analytics tiers. Les accès restent protégés par le contrôle administrateur côté serveur.</p>
  </main>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><CardContent className="p-5"><div className="text-primary">{icon}</div><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>;
}
