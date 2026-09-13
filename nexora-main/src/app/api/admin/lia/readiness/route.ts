import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { buildLiaProductionReadiness } from '@/lib/lia/production-readiness';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  try {
    await requireAdmin(supabase);
    return NextResponse.json(buildLiaProductionReadiness(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur de readiness LIA.';
    return NextResponse.json({ error: message }, { status: message.includes('Accès administrateur') ? 403 : 500 });
  }
}
