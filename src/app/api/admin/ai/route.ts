import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { liaChat, liaProviderConfig } from '@/lib/lia/provider';
import { assertSameOrigin } from "@/lib/security/csrf";
import { diagnosticId, errorInfo, logDiagnostic } from "@/lib/observability/server";

export const maxDuration = 180;

export async function POST(request: Request) {
  const requestId = diagnosticId();
  const startedAt = Date.now();
  logDiagnostic("info", "admin.ai.start", { requestId });
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  try {
    await requireAdmin(supabase);
    const body = await request.json().catch(() => ({}));
    const question = typeof body.question === 'string' ? body.question.trim().slice(0, 4000) : '';
    if (!question) return NextResponse.json({ error: 'Question manquante.' }, { status: 400 });

    const [runsResult, recentResult] = await Promise.all([
      supabase.from('agent_runs').select('status,agent_key,task_type,duration_ms,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
      supabase.from('recommendations').select('type,title,status,created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    if (runsResult.error || recentResult.error) throw new Error(runsResult.error?.message || recentResult.error?.message || 'Impossible de charger les métriques IA.');

    const runs = runsResult.data ?? [];
    const completed = runs.filter((r) => r.status === 'completed');
    const errors = runs.filter((r) => r.status === 'error');
    const durations = completed.map((r) => Number(r.duration_ms ?? 0)).filter((n) => n > 0);
    const avgDurationMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    const context = {
      scope: 'administration uniquement; agrégé; aucune donnée financière individuelle utilisateur',
      executions_last_100: runs.length,
      completed: completed.length,
      errors: errors.length,
      average_duration_ms: avgDurationMs,
      recent_runs: runs.slice(0, 20),
      recent_recommendations: recentResult.data ?? [],
      control_plane: 'nexora-native',
    };

    const messages = [
      { role: 'system' as const, content: `Tu es le copilote IA de l'administrateur de Gérer Finance. Tu aides à piloter et améliorer le produit. Tu peux analyser des métriques techniques agrégées, détecter des tendances, proposer des améliorations et expliquer les risques. Tu ne dois jamais prétendre avoir accès aux données individuelles non fournies, ni modifier automatiquement le produit. Toute amélioration technique doit être formulée comme une proposition soumise à validation humaine. Le control plane NEXORA est interne au produit et reste soumis à la validation humaine. Réponds en français, de façon concrète et structurée.` },
      { role: 'user' as const, content: `Question de l'administrateur : ${question}\n\nCONTEXTE TECHNIQUE AGRÉGÉ :\n${JSON.stringify(context)}` },
    ];

    // Administration IA uses the same governed NEXORA provider boundary as the product.
    // The native local runtime is preferred; Ollama is only a compatibility lane.
    const providerConfig = liaProviderConfig();
    let result: { content: string; model: string; provider: string };
    try {
      const governed = await liaChat(messages, AbortSignal.timeout(Number(process.env.NEXORA_AI_TIMEOUT_MS || 180000)));
      result = governed;
    } catch (error) {
      return NextResponse.json({
        requestId,
        error: error instanceof Error ? error.message : 'Le moteur IA local NEXORA est indisponible.',
        code: 'LOCAL_AI_UNAVAILABLE',
        provider: providerConfig.mode,
      }, { status: 503 });
    }

    logDiagnostic("info", "admin.ai.success", { requestId, durationMs: Date.now() - startedAt, provider: result.provider, model: result.model });
    return NextResponse.json({
      requestId,
      analysis: result.content,
      model: result.model,
      provider: result.provider,
      localAi: { native: { configured: false, enabled: false }, ollama: providerConfig.local, selected: providerConfig.mode },
      metrics: { executions: runs.length, errors: errors.length, avgDurationMs },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur IA administrateur.';
    const status = message.includes('Accès administrateur') ? 403 : 502;
    logDiagnostic("error", "admin.ai.failed", { requestId, durationMs: Date.now() - startedAt, status, ...errorInfo(error) });
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
