import { getMobileAuth, mobileAuthResponse } from "@/lib/auth/mobile";

export async function GET(request: Request) {
  try {
    const auth = await getMobileAuth(request);
    if (!auth) return mobileAuthResponse();
    const { data, error } = await auth.supabase
      .from("bank_connections")
      .select("id,provider,status,institution_name,last_synced_at,consent_expires_at")
      .eq("user_id", auth.user.id)
      .order("last_synced_at", { ascending: false });
    if (error) throw error;
    return Response.json({ connections: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Connexions bancaires indisponibles." }, { status: 500 });
  }
}
