import { getMobileAuth, mobileAuthResponse } from "@/lib/auth/mobile";
import { buildEnterpriseDashboardContext } from "@/lib/enterprise/dashboard-context";

export async function GET(request: Request) {
  try {
    const auth = await getMobileAuth(request);
    if (!auth) return mobileAuthResponse();
    const context = await buildEnterpriseDashboardContext({ supabase: auth.supabase, userId: auth.user.id });
    if (!context.company.verified) return Response.json({ available: false }, { headers: { "Cache-Control": "private, no-store" } });
    return Response.json({ available: true, context }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Espace entreprise indisponible." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
