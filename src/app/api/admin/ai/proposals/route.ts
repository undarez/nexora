import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { assertSameOrigin } from "@/lib/security/csrf";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  try {
    const admin = await requireAdmin(supabase);
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '';
    const priority = ['low', 'medium', 'high', 'critical'].includes(body.priority) ? body.priority : 'medium';
    if (!title || !description) return NextResponse.json({ error: 'Titre et description requis.' }, { status: 400 });
    const { data, error } = await supabase.from('ai_improvement_proposals').insert({ created_by: admin.id, title, description, priority, status: 'proposed' }).select('id,title,description,priority,status,created_at').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ proposal: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de créer la proposition.';
    return NextResponse.json({ error: message }, { status: message.includes('Accès administrateur') ? 403 : 500 });
  }
}
