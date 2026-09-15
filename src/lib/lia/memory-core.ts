import type { SupabaseClient } from "@supabase/supabase-js";
import { retrieveLiaMemories, compactMemoryContext, type LiaMemoryContext } from "@/lib/lia/memory-context";
import { sanitizeMemoryValue } from "@/lib/lia/memory-policy";

export type LiaMemorySnapshot = {
  recalled: LiaMemoryContext[];
  compact: ReturnType<typeof compactMemoryContext>;
  loadedAt: string;
  query: string;
};

const MAX_QUERY = 1600;
const MAX_EPISODE = 2200;

/** Durable memory facade used by the autonomous core. */
export async function loadLiaMemory(supabase: SupabaseClient, userId: string, query: string): Promise<LiaMemorySnapshot> {
  const safeQuery = String(query ?? "").slice(0, MAX_QUERY);
  const recalled = await retrieveLiaMemories(supabase, userId, safeQuery);
  return { recalled, compact: compactMemoryContext(recalled), loadedAt: new Date().toISOString(), query: safeQuery };
}

/** Persist a bounded episodic trace; never stores secrets or raw provider payloads. */
export async function rememberLiaEpisode(args: {
  supabase: SupabaseClient;
  userId: string;
  topic: string;
  summary: string;
  loopRunId?: string | null;
  reliability?: number;
}) {
  const content = sanitizeMemoryValue({
    summary: String(args.summary).slice(0, MAX_EPISODE),
    loop_run_id: args.loopRunId ?? null,
    source: "lia_autonomous_core",
  });
  const { data, error } = await args.supabase.from("lia_memory").insert({
    user_id: args.userId,
    memory_type: "episodic",
    topic: String(args.topic).slice(0, 300),
    content,
    source_kind: "autonomous_episode",
    source_id: args.loopRunId ?? null,
    reliability: Math.max(0, Math.min(100, Number(args.reliability ?? 70))),
    reproducible: false,
    status: "accepted",
  }).select("id").single();
  if (error) throw new Error(`Mémoire épisodique non enregistrée: ${error.message}`);
  return String(data.id);
}

export async function getMemoryStats(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("lia_memory").select("memory_type,status").eq("user_id", userId).limit(500);
  if (error) throw new Error(error.message);
  const stats = { working: 0, episodic: 0, semantic: 0, procedural: 0, strategic: 0, candidates: 0, accepted: 0 };
  for (const row of data ?? []) {
    if (row.memory_type in stats) stats[row.memory_type as keyof typeof stats] += 1;
    if (row.status === "candidate") stats.candidates += 1;
    if (row.status === "accepted") stats.accepted += 1;
  }
  return stats;
}
