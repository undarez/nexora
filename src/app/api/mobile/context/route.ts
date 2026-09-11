import { buildUnifiedFinancialContext } from "@/lib/finance/unified-financial-context";
import { getMobileAuth, mobileAuthResponse } from "@/lib/auth/mobile";

export async function GET(request: Request) {
  try {
    const auth = await getMobileAuth(request);
    if (!auth) return mobileAuthResponse();
    const url = new URL(request.url);
    const period = url.searchParams.get("month") || undefined;
    const context = await buildUnifiedFinancialContext({ supabase: auth.supabase, userId: auth.user.id, periodStart: period });
    return Response.json(context, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Contexte financier indisponible." }, { status: 500 });
  }
}
