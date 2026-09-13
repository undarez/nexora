import type { SupabaseClient } from '@supabase/supabase-js';

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return configuredAdminEmails().includes(email.toLowerCase());
}

export async function getAdminContext(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, isAdmin: false };
  return { user, isAdmin: isAdminEmail(user.email) };
}

export async function requireAdmin(supabase: SupabaseClient) {
  const context = await getAdminContext(supabase);
  if (!context.user || !context.isAdmin) throw new Error('Accès administrateur requis.');
  return context.user;
}
