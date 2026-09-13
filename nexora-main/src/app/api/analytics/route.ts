import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/security/csrf';

const ROUTE_RE = /^\/[A-Za-z0-9_\-./#]*$/;
const SESSION_RE = /^[A-Za-z0-9_-]{16,80}$/;
const FEATURE_RE = /^[a-z0-9_\-]{1,80}$/;
const ALLOWED_EVENTS = new Set(['page_view', 'feature_view']);

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false }, { status: 400 });
  const input = body as Record<string, unknown>;
  const eventName = typeof input.event_name === 'string' ? input.event_name : '';
  const route = typeof input.route === 'string' ? input.route : '';
  const sessionId = typeof input.session_id === 'string' ? input.session_id : '';
  const featureKey = typeof input.feature_key === 'string' ? input.feature_key : null;

  if (!ALLOWED_EVENTS.has(eventName) || !ROUTE_RE.test(route) || route.length > 200 || !SESSION_RE.test(sessionId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (featureKey !== null && !FEATURE_RE.test(featureKey)) return NextResponse.json({ ok: false }, { status: 400 });
  if (eventName === 'feature_view' && !featureKey) return NextResponse.json({ ok: false }, { status: 400 });

  const { error } = await supabase.from('product_analytics_events').insert({
    user_id: user.id,
    session_id: sessionId,
    event_name: eventName,
    route,
    feature_key: featureKey,
  });
  if (error) {
    // Analytics is non-critical product telemetry. A deployment may briefly
    // run before migration 0095 has been applied; never break the product for
    // that optional subsystem.
    if (error.code === '42P01' || /product_analytics_events.*schema cache/i.test(error.message)) {
      return NextResponse.json({ ok: true, skipped: 'analytics_schema_unavailable' });
    }
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
