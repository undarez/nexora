import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverTrustedSources } from "@/lib/lia/research/search";
import { acquireSource } from "@/lib/lia/research/gateway";
import { getResearchDomainPolicy } from "@/lib/lia/research/trust/registry";
import { evaluateResearch, type ResearchEvidence } from "@/lib/lia/research/evidence";
import { buildKnowledgeGraph } from "@/lib/lia/knowledge-graph";
import { acceptLearningRecord } from "@/lib/lia/cognitive-core";
import { buildMetacognitivePlan, recordMetacognitivePlan } from "@/lib/lia/learning/metacognition";

export type LearningTopic = {
  id: string;
  query: string;
  area: "finance" | "regulation" | "security" | "privacy" | "methodology";
  priority: number;
};

const CURRICULUM: LearningTopic[] = [
  { id: "finance-budgeting", query: "budget personnel gestion des dépenses épargne finances personnelles", area: "finance", priority: 90 },
  { id: "finance-cashflow", query: "cash flow budget prévision trésorerie finances personnelles", area: "finance", priority: 85 },
  { id: "finance-europe", query: "finance personnelle Europe réglementation épargne consommateurs services financiers", area: "finance", priority: 70 },
  { id: "regulation-eu", query: "réglementation européenne services financiers protection consommateur finance numérique", area: "regulation", priority: 95 },
  { id: "privacy-gdpr", query: "RGPD protection données applications web données financières", area: "privacy", priority: 95 },
  { id: "security-web", query: "sécurité application web authentification API protection données financières", area: "security", priority: 95 },
  { id: "security-ai", query: "sécurité agent IA garde-fous autonomie outils validation humain", area: "security", priority: 100 },
  { id: "ai-governance", query: "gouvernance intelligence artificielle gestion des risques agent IA Europe", area: "regulation", priority: 95 },
  { id: "methodology-evidence", query: "méthodologie preuve vérification sources contradictoires recherche scientifique", area: "methodology", priority: 80 },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function knowledgeAuthorityForTier(tier: string) {
  const t = tier.toLowerCase();
  if (/(official|regulatory|government|authority)/.test(t)) return "A";
  if (/(research|academic|scientific)/.test(t)) return "B";
  if (/(vendor|industry)/.test(t)) return "C";
  if (/(unknown|untrusted)/.test(t)) return "E";
  return "D";
}
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => normalize(s).split(/\s+/).filter(x => x.length >= 4);
const similarity = (a: string, b: string) => {
  const A = new Set(tokens(a)); const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / (A.size + B.size - n);
};

function sentenceCandidates(text: string, query: string, limit = 10) {
  const q = new Set(tokens(query));
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 70 && s.length <= 700)
    .filter(s => !/^cookie|^privacy policy|^menu|^javascript|^sign in|^subscribe/i.test(s));
  return sentences.map((sentence, index) => {
    const words = new Set(tokens(sentence));
    let hits = 0; for (const w of words) if (q.has(w)) hits++;
    return { sentence, score: hits * 10 + Math.max(0, 5 - index) };
  }).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.sentence);
}

function chooseTopic(recent: Array<{ topic?: string | null }>): LearningTopic {
  const used = recent.map(x => String(x.topic ?? ""));
  return [...CURRICULUM]
    .sort((a, b) => {
      const ac = used.filter(x => x === a.id).length;
      const bc = used.filter(x => x === b.id).length;
      return (a.priority - ac * 25) - (b.priority - bc * 25);
    })[0] ?? CURRICULUM[0];
}

export async function runAutonomousLearningCycle(admin: SupabaseClient, userId: string) {
  const startedAt = new Date().toISOString();
  const { data: recent } = await admin
    .from("lia_autonomous_learning_cycles")
    .select("topic,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  const topic = chooseTopic((recent ?? []) as Array<{ topic?: string | null }>);
  const metacognitivePlan = await buildMetacognitivePlan(admin, userId, topic.query);
  const { data: cycle, error: cycleError } = await admin
    .from("lia_autonomous_learning_cycles")
    .insert({ user_id: userId, topic: topic.id, query: topic.query, area: topic.area, status: "running", started_at: startedAt })
    .select("id")
    .single();
  if (cycleError || !cycle) throw new Error(cycleError?.message ?? "learning_cycle_create_failed");

  const metacognitiveCycleId = await recordMetacognitivePlan(admin, userId, metacognitivePlan, cycle.id);

  const updateCycle = async (patch: Record<string, unknown>) => {
    await admin.from("lia_autonomous_learning_cycles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", cycle.id);
  };

  try {
    const discovery = await discoverTrustedSources(topic.query, 5);
    if (!discovery.results.length) {
      await updateCycle({ status: "waiting_for_search_provider", finished_at: new Date().toISOString(), provider: discovery.provider, sources_found: 0 });
      return { status: "waiting_for_search_provider", cycleId: cycle.id, metacognitiveCycleId, topic: topic.id, provider: discovery.provider, sources: 0, nextObjective: metacognitivePlan.nextObjective };
    }

    const evidence: ResearchEvidence[] = [];
    let acquisitions = 0;
    let candidates = 0;
    const sourceRefs: string[] = [];

    for (const result of discovery.results.slice(0, 4)) {
      const host = new URL(result.url).hostname;
      const policy = getResearchDomainPolicy(host);
      if (!policy.allowed || !policy.entry) continue;
      try {
        const acquired = await acquireSource({ url: result.url, timeoutMs: 8000, maxBytes: 450_000, maxRedirects: 2, allowedHosts: [policy.entry.domain] });
        acquisitions++;
        const { data: sourceRow } = await admin.from("lia_research_acquisitions").insert({
          user_id: userId,
          requested_url: result.url,
          final_url: acquired.finalUrl,
          status: acquired.status,
          content_type: acquired.contentType,
          title: acquired.title ?? result.title,
          text: acquired.text.slice(0, 450_000),
          observed_at: acquired.observedAt,
          redirects: acquired.redirects,
          truncated: acquired.truncated,
          source_host: host,
          execution_allowed: false,
        }).select("id").single();
        if (sourceRow?.id) sourceRefs.push(String(sourceRow.id));

        const facts = sentenceCandidates(acquired.text, topic.query, 5);
        for (const fact of facts) {
          candidates++;
          evidence.push({
            id: `learning-${candidates}`,
            claim: fact,
            source: { tier: policy.entry.sourceClass.toLowerCase() as ResearchEvidence["source"]["tier"], title: acquired.title ?? result.title, url: acquired.finalUrl, publisher: policy.entry.organization, publishedAt: result.publishedAt ?? undefined, observedAt: acquired.observedAt },
            confidence: clamp(policy.entry.trustScore, 0, 100),
          });
        }
      } catch {
        // A single source failure must not abort the learning cycle.
      }
    }

    const research = evaluateResearch(topic.query, evidence);
    const nodes = evidence.map(e => ({ id: e.id, topic: topic.id, claim: e.claim, state: e.state === "stale" ? "uncertain" as const : "uncertain" as const, confidence: e.confidence ?? 0, source: { kind: "research", id: e.id, url: e.source.url ?? null, publishedAt: e.source.publishedAt ?? null }, observedAt: e.source.observedAt ?? startedAt }));
    const graph = buildKnowledgeGraph(nodes);
    await admin.from("lia_knowledge_graph_runs").insert({ user_id: userId, nodes: graph.nodes, edges: graph.edges, contradictions: graph.contradictions, stale_candidates: graph.staleCandidates, provenance_required: true, activation_allowed: false });

    const verified = research.claims.filter(c => c.state === "verified");
    const acceptedMemoryIds: string[] = [];
    for (const claim of verified.slice(0, 6)) {
      const matched = evidence.filter(e => claim.evidenceIds.includes(e.id));
      const distinctSources = new Set(matched.map(e => e.source.url)).size;
      if (distinctSources < 2) continue;
      const { data: knowledge, error: knowledgeError } = await admin.from("lia_knowledge").insert({
        user_id: userId,
        claim: claim.claim,
        source: matched.map(e => e.source.url).filter(Boolean).join(" | ").slice(0, 2000),
        source_type: matched.map(e => e.source.tier).join(","),
        publication_date: matched.find(e => e.source.publishedAt)?.source.publishedAt?.slice(0, 10) ?? null,
        confidence: claim.confidence,
        corroboration: matched.map(e => ({ id: e.id, url: e.source.url, publisher: e.source.publisher, tier: e.source.tier })),
        contradictions: [],
        state: "verified",
        verified: true,
        metadata: { learning_cycle_id: cycle.id, topic: topic.id, autonomous: true, provenance_required: true },
      }).select("id").single();
      if (knowledgeError || !knowledge) continue;

      // Bridge validated autonomous research into the dedicated Financial Agent Memory Pipeline.
      // The claim is promoted only after the same deterministic corroboration gate has passed.
      try {
        const evidenceRows = matched.map(e => ({ url: e.source.url, title: e.source.title, publisher: e.source.publisher, tier: e.source.tier, observedAt: e.source.observedAt }));
        const sourceIds: string[] = [];
        for (const evidenceItem of evidenceRows) {
          if (!evidenceItem.url) continue;
          const sourceKey = `learning:${new URL(evidenceItem.url).hostname}:${Buffer.from(evidenceItem.url).toString("base64url").slice(0, 48)}`;
          const source = await admin.from("financial_knowledge_sources").upsert({ source_key: sourceKey, title: evidenceItem.title || evidenceItem.url, publisher: evidenceItem.publisher || null, authority: knowledgeAuthorityForTier(evidenceItem.tier), url: evidenceItem.url, status: "active" }, { onConflict: "source_key" }).select("id").single();
          if (source.data?.id) sourceIds.push(String(source.data.id));
        }
        if (sourceIds.length >= 2) {
          const knowledgeKey = `learning:${topic.id}:${Buffer.from(claim.claim).toString("base64url").slice(0, 64)}`;
          const item = await admin.from("financial_knowledge_items").upsert({
            knowledge_key: knowledgeKey, knowledge_type: "claim", domain: "financial_agents", title: `Connaissance apprise — ${topic.id}`,
            statement: claim.claim, authority: knowledgeAuthorityForTier(matched[0]?.source.tier || "unknown"), confidence: Math.min(1, Math.max(0, Number(claim.confidence ?? 0) / 100)),
            status: "validated", tags: [topic.id, "autonomous_learning", "corroborated"], metadata: { learning_cycle_id: cycle.id, source_knowledge_id: knowledge.id, source_count: sourceIds.length, provenance_required: true }
          }, { onConflict: "knowledge_key" }).select("id").single();
          if (item.data?.id) {
            for (let i = 0; i < matched.length; i++) {
              const evidenceItem = matched[i];
              const sourceId = sourceIds[i];
              if (!sourceId) continue;
              await admin.from("financial_knowledge_evidence").insert({ knowledge_id: item.data.id, source_id: sourceId, evidence_location: evidenceItem.source.url, excerpt: evidenceItem.claim?.slice(0, 2000) || claim.claim.slice(0, 2000) });
            }
          }
        }
      } catch (pipelineError) {
        console.warn("Pont mémoire financière indisponible; apprentissage principal conservé:", pipelineError instanceof Error ? pipelineError.message : pipelineError);
      }

      try {
        const learned = await acceptLearningRecord(admin, userId, {
          lesson: claim.claim,
          context: { topic: topic.id, area: topic.area, cycle_id: cycle.id },
          action: { type: "external_research", sources: matched.map(e => e.source.url) },
          expectedResult: { corroborated: true },
          actualResult: { corroborated: true, evidence_count: matched.length },
          validation: { method: "deterministic_corroboration", knowledge_id: knowledge.id },
          confidence: claim.confidence,
          reproducible: true,
          memoryType: "semantic",
          topic: topic.id,
        });
        acceptedMemoryIds.push(learned.learningId);
      } catch {
        // Knowledge is already stored; memory promotion can be retried later.
      }
    }

    const status = research.contradictions.length ? "blocked_contradiction" : verified.length ? "learned" : "candidate_knowledge";
    await admin.from("lia_metacognitive_cycles").update({ status: "evaluated", evaluation: { verified_claims: verified.length, contradictions: research.contradictions.length, sources_acquired: acquisitions, action: metacognitivePlan.action, confidence: verified.length ? 80 : 40 }, next_objective: metacognitivePlan.nextObjective, updated_at: new Date().toISOString() }).eq("id", metacognitiveCycleId).eq("user_id", userId);
    await updateCycle({
      status,
      finished_at: new Date().toISOString(),
      provider: discovery.provider,
      sources_found: discovery.results.length,
      sources_acquired: acquisitions,
      knowledge_candidates: candidates,
      verified_knowledge: verified.length,
      contradictions: research.contradictions.length,
      accepted_memories: acceptedMemoryIds.length,
      source_refs: sourceRefs,
      guardrails: { trusted_domains_only: true, max_sources: 4, max_bytes: 450000, timeout_ms: 8000, activation_allowed: false, financial_writes_allowed: false },
    });
    return { status, cycleId: cycle.id, metacognitiveCycleId, topic: topic.id, provider: discovery.provider, sources: acquisitions, candidates, verified: verified.length, contradictions: research.contradictions.length, nextObjective: metacognitivePlan.nextObjective };
  } catch (error) {
    await updateCycle({ status: "failed", finished_at: new Date().toISOString(), error: error instanceof Error ? error.message : "learning_cycle_failed" });
    throw error;
  }
}
