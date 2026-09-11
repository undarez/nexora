import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { assertSameOrigin } from '@/lib/security/csrf';

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server secret missing.');
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  try {
    const adminUser = await requireAdmin(auth);
    const db = adminDb();
    const [{ data: jobs, error: jobsError }, { data: events, error: eventsError }, { data: control, error: controlError }] = await Promise.all([
      db.from('lia_runtime_jobs').select('id,user_id,name,description,schedule,status,payload,next_run_at,last_run_at,last_status,requires_policy_gate,requires_human_approval,timezone,execution_mode,admin_disabled,admin_disabled_at,admin_disabled_by,admin_disabled_reason,created_at,updated_at').eq('runtime_type','cron').order('updated_at',{ ascending:false }).limit(200),
      db.from('lia_runtime_events').select('id,user_id,runtime_job_id,event,status,payload,created_at').eq('runtime_type','cron').order('created_at',{ ascending:false }).limit(300),
      db.from('lia_runtime_controls').select('cron_autonomy_enabled,updated_at,updated_by').eq('id',1).maybeSingle(),
    ]);
    if (jobsError || eventsError || controlError) throw new Error(jobsError?.message || eventsError?.message || controlError?.message || 'Impossible de charger les Cron LIA.');
    return NextResponse.json({ admin_user_id: adminUser.id, control: control ?? { cron_autonomy_enabled: true }, jobs: jobs ?? [], events: events ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Accès administrateur requis.' }, { status: 403 }); }
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Requête refusée.' }, { status: 403 }); }
  const auth = await createClient();
  if (!auth) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  try {
    const adminUser = await requireAdmin(auth);
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';
    const db = adminDb();
    if (action === 'global_enable' || action === 'global_disable') {
      const enabled = action === 'global_enable';
      const { error } = await db.rpc('lia_admin_set_cron_enabled', { p_enabled: enabled, p_admin_user_id: adminUser.id });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, action, enabled });
    }
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    if (!jobId) return NextResponse.json({ error: 'jobId requis.' }, { status: 400 });
    if (action === 'disable') {
      const { error } = await db.from('lia_runtime_jobs').update({ admin_disabled: true, admin_disabled_at: new Date().toISOString(), admin_disabled_by: adminUser.id, admin_disabled_reason: typeof body.reason === 'string' ? body.reason.slice(0,300) : 'Désactivé par l’administration', status: 'paused', last_status: 'admin_disabled', updated_at: new Date().toISOString() }).eq('id',jobId).eq('runtime_type','cron');
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, action, jobId });
    }
    if (action === 'enable') {
      const { data: control } = await db.from('lia_runtime_controls').select('cron_autonomy_enabled').eq('id',1).maybeSingle();
      if (control?.cron_autonomy_enabled === false) return NextResponse.json({ error: 'Le kill switch global est actif. Réactivez d’abord l’autonomie des Cron.' }, { status: 409 });
      const { error } = await db.from('lia_runtime_jobs').update({ admin_disabled: false, admin_disabled_at: null, admin_disabled_by: null, admin_disabled_reason: null, status: 'ready', last_status: 'admin_reenabled', updated_at: new Date().toISOString() }).eq('id',jobId).eq('runtime_type','cron');
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, action, jobId });
    }
    if (action === 'delete') {
      const { error } = await db.from('lia_runtime_jobs').delete().eq('id',jobId).eq('runtime_type','cron');
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, action, jobId });
    }
    return NextResponse.json({ error: 'Action Cron admin non autorisée.' }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Action administrative impossible.' }, { status: 503 }); }
}
