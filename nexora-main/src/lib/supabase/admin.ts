import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let adminClient: SupabaseClient | null | undefined;
export function getSupabaseAdmin() {
  if (adminClient !== undefined) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  adminClient = url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
  return adminClient;
}
