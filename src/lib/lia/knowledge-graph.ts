import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeState = "known" | "unknown" | "uncertain" | "assumed" | "verified" | "contradicted";
export type KnowledgeNode = {
  id: string;
  topic: string;
  claim: string;
  state: KnowledgeState;
  confidence: number;
  source?: { kind: string; id?: string | null; url?: string | null; publishedAt?: string | null };
  observedAt?: string;
  expiresAt?: string | null;
};
export type KnowledgeEdge = { from: string; to: string; relation: "supports" | "contradicts" | "depends_on" | "derived_from" | "supersedes" };

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const words = (s: string) => new Set(normalize(s).split(/\s+/).filter(x => x.length >= 3));
const overlap = (a: string, b: string) => {
  const A = words(a), B = words(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / (A.size + B.size - n);
};

/** Builds a provenance-aware graph proposal. It never activates, deletes, or rewrites memory. */
export function buildKnowledgeGraph(nodes: KnowledgeNode[], now = new Date()) {
  const clean = nodes.slice(0, 200).map(n => ({ ...n, confidence: Math.max(0, Math.min(100, n.confidence)) }));
  const edges: KnowledgeEdge[] = [];
  const contradictions: Array<{ from: string; to: string; reason: string }> = [];
  const stale: string[] = [];
  for (let i = 0; i < clean.length; i++) {
    const a = clean[i];
    if (a.expiresAt && new Date(a.expiresAt).getTime() <= now.getTime()) stale.push(a.id);
    for (let j = i + 1; j < clean.length; j++) {
      const b = clean[j];
      if (normalize(a.topic) === normalize(b.topic) && a.state === "verified" && b.state === "contradicted") {
        edges.push({ from: a.id, to: b.id, relation: "contradicts" });
        contradictions.push({ from: a.id, to: b.id, reason: "Deux états incompatibles portent sur le même sujet; arbitrage requis." });
      }
      if (overlap(a.claim, b.claim) >= 0.72) edges.push({ from: b.id, to: a.id, relation: "supports" });
      if (a.source?.id && a.source.id === b.source?.id && a.id !== b.id) edges.push({ from: b.id, to: a.id, relation: "derived_from" });
    }
  }
  return {
    generatedAt: now.toISOString(),
    nodes: clean,
    edges: edges.filter((e, i, all) => all.findIndex(x => x.from === e.from && x.to === e.to && x.relation === e.relation) === i),
    contradictions,
    staleCandidates: [...new Set(stale)],
    provenanceRequired: true,
    activationAllowed: false,
    writePolicy: "knowledge_graph_proposal_only" as const,
  };
}

export async function persistKnowledgeGraph(admin: SupabaseClient, userId: string, graph: ReturnType<typeof buildKnowledgeGraph>) {
  const { data, error } = await admin.from("lia_knowledge_graph_runs").insert({
    user_id: userId, nodes: graph.nodes, edges: graph.edges, contradictions: graph.contradictions,
    stale_candidates: graph.staleCandidates, provenance_required: true, activation_allowed: false,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
