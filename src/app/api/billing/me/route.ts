import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PLAN_FEATURES, PREMIUM_PRICE_MONTHLY_EUR, PREMIUM_PRICE_YEARLY_EUR, resolveEntitlement } from "@/lib/billing/entitlements";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Supabase indisponible." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const entitlement = await resolveEntitlement({ supabase, admin: getSupabaseAdmin(), userId: user.id, email: user.email });
  return NextResponse.json({ ...entitlement, pricing: { monthly: PREMIUM_PRICE_MONTHLY_EUR, yearly: PREMIUM_PRICE_YEARLY_EUR }, features: PLAN_FEATURES[entitlement.plan] }, { headers: { "Cache-Control": "no-store" } });
}
