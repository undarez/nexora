import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectFinancialSignals } from "@/lib/finance/financial-watch";
import { assertSameOrigin } from "@/lib/security/csrf";
import { runProactiveFinancialLoop } from "@/lib/lia/proactive/loop";

async function getWatchContext() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null, error: "Supabase non configuré." as const };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Session requise." as const };
  const [tx, accounts, scenario] = await Promise.all([
    supabase.from("transactions").select("id,label,amount,occurred_at").eq("user_id", user.id).order("occurred_at", { ascending: false }).limit(500),
    supabase.from("accounts").select("balance").eq("user_id", user.id).limit(50),
    supabase.from("budget_scenarios").select("safety_reserve").eq("user_id", user.id).order("period_start", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (tx.error || accounts.error || scenario.error) return { supabase, user, error: "Contexte financier indisponible." as const };
  const balance=(accounts.data??[]).reduce((s,a)=>s+Number(a.balance??0),0);
  const reserve=Number(scenario.data?.safety_reserve??0);
  const signals=detectFinancialSignals((tx.data??[]).map(t=>({ ...t, amount:Number(t.amount) })), balance, reserve);
  return { supabase, user, signals, error: null };
}

export async function GET() {
  const ctx=await getWatchContext();
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.error==="Session requise." ? 401 : 503 });
  return NextResponse.json({ signals: ctx.signals, generatedAt:new Date().toISOString() });
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch { return NextResponse.json({ error:"Origine refusée." }, { status:403 }); }
  const ctx=await getWatchContext();
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.error==="Session requise." ? 401 : 503 });
  const { error } = await ctx.supabase!.rpc("publish_financial_watch_notifications", {
    p_user_id: ctx.user!.id,
    p_signals: ctx.signals ?? [],
  });
  if (error) return NextResponse.json({ error:"Publication des signaux indisponible." }, { status:503 });
  const proactive = ctx.signals?.length ? await runProactiveFinancialLoop(ctx.supabase!, ctx.user!.id, ctx.signals[0].id).catch((loopError) => ({ status:"failed", error: loopError instanceof Error ? loopError.message : "Boucle proactive indisponible." })) : { status:"no_signal" };
  return NextResponse.json({ published:true, count: ctx.signals?.length ?? 0, proactive });
}
