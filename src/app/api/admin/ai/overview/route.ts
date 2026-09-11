import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/admin';
import { ollamaHealth, ollamaConfig } from '@/lib/ollama/client';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  try {
    await requireAdmin(supabase);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: runs, error } = await supabase.from('agent_runs').select('agent_key,status,duration_ms,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    const rows = runs ?? [];
    const byAgent = new Map<string, { agent: string; runs: number; errors: number; durations: number[] }>();
    for (const run of rows) {
      const key = run.agent_key || 'unknown';
      const current: { agent: string; runs: number; errors: number; durations: number[] } = byAgent.get(key) ?? { agent: key, runs: 0, errors: 0, durations: [] };
      current.runs += 1;
      if (run.status === 'error') current.errors += 1;
      const duration = Number(run.duration_ms ?? 0);
      if (duration > 0) current.durations.push(duration);
      byAgent.set(key, current);
    }
    const agents = [...byAgent.values()].map((item) => ({
      agent: item.agent,
      runs: item.runs,
      errors: item.errors,
      errorRate: item.runs ? Number((item.errors / item.runs).toFixed(3)) : 0,
      avgDurationMs: item.durations.length ? Math.round(item.durations.reduce((a, b) => a + b, 0) / item.durations.length) : 0,
    })).sort((a, b) => b.runs - a.runs);
    const controlDb = getSupabaseAdmin();
    if (!controlDb) throw new Error('Secret serveur Supabase indisponible pour le control plane.');
    const [ollama, runtimeJobsResult, runtimeEventsResult] = await Promise.all([
      ollamaHealth(),
      controlDb.from('lia_runtime_jobs').select('id,status,runtime_type,admin_disabled,last_run_at,next_run_at').limit(200),
      controlDb.from('lia_runtime_events').select('id,runtime_type,event,status,created_at').order('created_at', { ascending: false }).limit(200),
    ]);
    if (runtimeJobsResult.error || runtimeEventsResult.error) throw new Error(runtimeJobsResult.error?.message || runtimeEventsResult.error?.message || 'Impossible de charger le control plane LIA.');
    const runtimeJobs = runtimeJobsResult.data ?? [];
    const runtimeEvents = runtimeEventsResult.data ?? [];
    const controlPlane = {
      mode: 'nexora-native',
      jobs: runtimeJobs.length,
      activeJobs: runtimeJobs.filter((j) => ['ready','running'].includes(String(j.status)) && !j.admin_disabled).length,
      runningJobs: runtimeJobs.filter((j) => j.status === 'running').length,
      recentEvents: runtimeEvents.length,
      lastEventAt: runtimeEvents[0]?.created_at ?? null,
    };
    return NextResponse.json({
      period: '24h',
      totalRuns: rows.length,
      errors: rows.filter((r) => r.status === 'error').length,
      agents,
      services: { ollama: ollama }, localAi: ollamaConfig(), controlPlane,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur de supervision IA.';
    return NextResponse.json({ error: message }, { status: message.includes('Accès administrateur') ? 403 : 502 });
  }
}
