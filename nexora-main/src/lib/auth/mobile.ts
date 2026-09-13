import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type MobileAuth = {
  supabase: SupabaseClient;
  user: User;
};

/**
 * Auth boundary for native clients.
 * The Android app sends a Supabase access token in Authorization: Bearer.
 * The publishable key is safe for client-side use; service-role keys never enter this path.
 */
export async function getMobileAuth(request: Request): Promise<MobileAuth | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1]?.trim();
  if (!accessToken) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase non configuré.");

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export function mobileAuthResponse() {
  return Response.json({ error: "Authentification requise." }, { status: 401 });
}
