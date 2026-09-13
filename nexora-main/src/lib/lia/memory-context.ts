import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyLiaMemory, sanitizeMemoryValue } from "@/lib/lia/memory-policy";

export type LiaMemoryContext = {
  id: string;
  memoryType: string;
  topic: string;
  content: Record<string, unknown>;
  reliability: number;
  reproducible: boolean | null;
  createdAt: string;
};

const MAX_MEMORIES = 8;
const MAX_CONTENT = 1800;

function normalize(value: string) {
  return value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokens(question: string) {
  return normalize(question).split(/[^a-z0-9]+/).filter((token) => token.length >= 4).slice(0, 32);
}

/**
 * Durable memory is opt-in by state: only accepted memories enter the chat context.
 * Candidates/rejected/stale memories are never surfaced to the model.
 */
export async function retrieveLiaMemories(supabase: SupabaseClient, userId: string, question: string): Promise<LiaMemoryContext[]> {
  let consentedPersonalization = false;
  try {
    const { data: relationship } = await supabase
      .from("lia_user_relationship_profiles")
      .select("consented_personalization")
      .eq("user_id", userId)
      .maybeSingle();
    consentedPersonalization = relationship?.consented_personalization === true;
  } catch {
    consentedPersonalization = false;
  }

  const { data, error } = await supabase
    .from("lia_memory")
    .select("id,memory_type,topic,content,reliability,reproducible,created_at,source_kind,expires_at")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error || !data) return [];
  const now = Date.now();
  const qTokens = new Set(tokens(question));
  const eligible = data.filter((memory: any) => {
    if (memory.expires_at && new Date(String(memory.expires_at)).getTime() <= now) return false;
    const policy = classifyLiaMemory({ memoryType: memory.memory_type, sourceKind: memory.source_kind, topic: memory.topic });
    return !policy.personalization || consentedPersonalization;
  });
  const ranked = eligible.map((memory: any) => {
    const topicTokens = tokens(String(memory.topic ?? ""));
    const contentText = JSON.stringify(memory.content ?? {});
    const contentTokens = tokens(contentText).slice(0, 40);
    const matches = [...topicTokens, ...contentTokens].filter((token) => qTokens.has(token)).length;
    const score = matches * 10 + Number(memory.reliability ?? 0) * 0.05;
    return { memory, score };
  }).filter((item) => item.score > 0 || qTokens.size === 0).sort((a, b) => b.score - a.score).slice(0, MAX_MEMORIES);

  return ranked.map(({ memory }) => ({
    id: String(memory.id),
    memoryType: String(memory.memory_type),
    topic: String(memory.topic),
    content: sanitizeMemoryValue(JSON.parse(JSON.stringify(memory.content ?? {}))) as Record<string, unknown>,
    reliability: Number(memory.reliability ?? 0),
    reproducible: memory.reproducible == null ? null : Boolean(memory.reproducible),
    createdAt: String(memory.created_at),
  }));
}

export function compactMemoryContext(memories: LiaMemoryContext[]) {
  return memories.map((memory) => ({
    type: memory.memoryType,
    topic: memory.topic,
    reliability: memory.reliability,
    content: JSON.stringify(memory.content).slice(0, MAX_CONTENT),
    created_at: memory.createdAt,
  }));
}

export function hasExplicitMemoryIntent(question: string) {
  return /\b(souviens[- ]toi|memorise|mémorise|garde en memoire|garde en mémoire|a l'avenir|à l'avenir|désormais|desormais|rappelle[- ]toi)\b/i.test(question);
}

/** Never auto-accept: explicit user intent creates a governed candidate only. */
export async function createMemoryCandidate(supabase: SupabaseClient, userId: string, question: string, loopRunId?: string | null) {
  if (!hasExplicitMemoryIntent(question)) return null;
  const topic = "Préférence ou instruction explicite utilisateur";
  const content = {
    instruction: question.slice(0, 1200),
    source: "explicit_user_request",
    loop_run_id: loopRunId ?? null,
    memory_gate: "candidate",
    activation_allowed: false,
  };
  const { data, error } = await supabase.from("lia_memory").insert({
    user_id: userId,
    memory_type: "strategic",
    topic,
    content,
    source_kind: "user_request",
    source_id: loopRunId ?? null,
    reliability: 50,
    reproducible: false,
    status: "candidate",
  }).select("id").single();
  if (error) return null;
  return data?.id ?? null;
}
