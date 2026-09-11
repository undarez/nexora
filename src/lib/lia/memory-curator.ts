import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryCandidate = {
  id: string;
  topic: string;
  memory_type: "observation" | "correction" | "proposal" | "decision";
  status: "pending" | "accepted" | "rejected" | "archived";
  evidence: Record<string, unknown>;
  confidence?: number | null;
  before_value?: Record<string, unknown> | null;
  after_value?: Record<string, unknown> | null;
};

export type CurationVerdict = "keep" | "merge_candidate" | "contradiction" | "obsolete_candidate";

const tokens = (value: string) => new Set((value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{3,}/g) ?? []));
const similarity = (a: string, b: string) => {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0; for (const x of A) if (B.has(x)) intersection++;
  return intersection / (A.size + B.size - intersection);
};

/** Deterministic curator: groups duplicates, surfaces contradictions, and proposes archival only. */
export function curateMemories(items: MemoryCandidate[], now = new Date()) {
  const active = items.filter(i => i.status !== "archived" && i.status !== "rejected");
  const groups: string[][] = [];
  const seen = new Set<string>();
  for (const item of active) {
    if (seen.has(item.id)) continue;
    const group = active.filter(other => other.id !== item.id && similarity(item.topic, other.topic) >= 0.72).map(x => x.id);
    if (group.length) { groups.push([item.id, ...group]); for (const id of group) seen.add(id); }
    seen.add(item.id);
  }

  const contradictions: Array<{ ids: string[]; reason: string }> = [];
  for (const group of groups) {
    const members = group.map(id => active.find(x => x.id === id)!).filter(Boolean);
    const hasPositive = members.some(m => /verified|success|succeed|accepted|correct/i.test(JSON.stringify(m.evidence)) || m.after_value?.outcome === "verified");
    const hasNegative = members.some(m => /mismatch|failed|failure|contradict|rejected/i.test(JSON.stringify(m.evidence)) || m.after_value?.outcome === "failed");
    if (hasPositive && hasNegative) contradictions.push({ ids: group, reason: "Des preuves ou résultats opposés portent sur un même sujet; arbitrage requis." });
  }

  const obsoleteCandidates = active.filter(item => {
    const raw = JSON.stringify(item.evidence).toLowerCase();
    return /obsolete|deprecated|expired/.test(raw) || (typeof item.confidence === "number" && item.confidence < 30);
  }).map(i => i.id);

  const mergeCandidates = groups.filter(g => !contradictions.some(c => c.ids.some(id => g.includes(id)))).map(ids => ({ ids, representativeId: ids.slice().sort()[0], reason: "Contenu suffisamment proche; consolidation candidate recommandée." }));
  return { generatedAt: now.toISOString(), inspected: active.length, duplicateGroups: groups, mergeCandidates, contradictions, obsoleteCandidates, activationAllowed: false, writePolicy: "curator_proposal_only" as const };
}

export async function persistCuration(admin: SupabaseClient, userId: string, report: ReturnType<typeof curateMemories>) {
  const { data, error } = await admin.from("lia_memory_curation_runs").insert({ user_id: userId, inspected_count: report.inspected, duplicate_groups: report.duplicateGroups, merge_candidates: report.mergeCandidates, contradictions: report.contradictions, obsolete_candidates: report.obsoleteCandidates, activation_allowed: false }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
