import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/security/csrf';
import { validateInteractionEvent } from '@/lib/lia/interaction-intelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ok:false},{status:403}); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ok:false},{status:503});
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ok:false},{status:401});
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ok:false},{status:400}); }
  const event = validateInteractionEvent(body);
  if (!event) return NextResponse.json({ok:false},{status:400});
  const {error} = await supabase.from('lia_interaction_events').insert({
    user_id:user.id, session_id:event.sessionId, event_type:event.eventType, path:event.path,
    feature_key:event.featureKey ?? null, target_key:event.targetKey ?? null,
    value_number:event.valueNumber ?? null, metadata:event.metadata ?? {},
  });
  if (error) {
    if (error.code === '42P01' || /lia_interaction_events.*schema cache/i.test(error.message)) return NextResponse.json({ok:true,skipped:'schema_unavailable'});
    return NextResponse.json({ok:false},{status:500});
  }
  return NextResponse.json({ok:true});
}
