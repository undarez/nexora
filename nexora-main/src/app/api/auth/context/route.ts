import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/admin';

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ user: null, isAdmin: false }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({
    user: user ? { id: user.id, email: user.email ?? null } : null,
    isAdmin: isAdminEmail(user?.email),
  });
}
