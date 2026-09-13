import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth/admin";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "admin_client_not_configured" }, { status: 503 });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from("lia_production_telemetry")
    .select("provider,model,latency_ms,input_chars,output_chars,generated_tokens,tokens_per_second,estimated_cost_cents,created_at")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: "production_runtime_unavailable" }, { status: 500 });
  const rows = data ?? [];
  const latencies = rows.map(r => r.latency_ms).filter((v): v is number => typeof v === "number").sort((a,b) => a-b);
  const percentile = (p: number) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((latencies.length - 1) * p))] : null;
  const generatedTokens = rows.reduce((n,r) => n + (Number(r.generated_tokens) || 0), 0);
  const estimatedCostCents = rows.reduce((n,r) => n + (Number(r.estimated_cost_cents) || 0), 0);
  const providers = new Map<string, { requests: number; avgLatencyMs: number | null; tokens: number; estimatedCostCents: number }>();
  for (const row of rows) {
    const key = row.provider || "unknown";
    const prev = providers.get(key) ?? { requests: 0, avgLatencyMs: null, tokens: 0, estimatedCostCents: 0 };
    const nextCount = prev.requests + 1;
    providers.set(key, { requests: nextCount, avgLatencyMs: row.latency_ms == null ? prev.avgLatencyMs : Math.round(((prev.avgLatencyMs ?? 0) * prev.requests + row.latency_ms) / nextCount), tokens: prev.tokens + (Number(row.generated_tokens) || 0), estimatedCostCents: Math.round((prev.estimatedCostCents + (Number(row.estimated_cost_cents) || 0)) * 100) / 100 });
  }
  return NextResponse.json({
    generatedAt: new Date().toISOString(), observationWindowHours: 24, sampleSize: rows.length,
    latency: { p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: latencies.length ? latencies[latencies.length - 1] : null },
    generatedTokens, estimatedCostCents: Math.round(estimatedCostCents * 100) / 100,
    configuredRemoteRate: { inputCentsPer1K: Number(process.env.LIA_REMOTE_INPUT_COST_CENTS_PER_1K || 0), outputCentsPer1K: Number(process.env.LIA_REMOTE_OUTPUT_COST_CENTS_PER_1K || 0), note: "Estimation opérateur, pas une facture." },
    providers: [...providers.entries()].map(([provider, summary]) => ({ provider, ...summary })),
  });
}
