import type { SupabaseClient } from "@supabase/supabase-js";

export type LettaMemory = {
  agentId: string;
  source: "letta" | "supabase-fallback";
  response?: string;
};

function config() {
  return {
    baseUrl: (process.env.LETTA_BASE_URL || "http://127.0.0.1:8283").replace(/\/$/, ""),
    apiKey: process.env.LETTA_API_KEY || "",
    model: process.env.LETTA_MODEL || "",
  };
}

function headers() {
  const c = config();
  return { "Content-Type": "application/json", ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}) };
}

async function lettaFetch(path: string, init?: RequestInit) {
  const c = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${c.baseUrl}${path}`, { ...init, headers: { ...headers(), ...(init?.headers || {}) }, cache: "no-store", signal: controller.signal });
    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) throw new Error(`Letta HTTP ${response.status}`);
    return data;
  } finally { clearTimeout(timer); }
}

export async function getLettaAgentId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("lia_memory_agents").select("external_agent_id").eq("user_id", userId).eq("provider", "letta").maybeSingle();
  if (error) throw new Error(error.message);
  return data?.external_agent_id ? String(data.external_agent_id) : null;
}

export async function ensureLettaAgent(supabase: SupabaseClient, userId: string) {
  const existing = await getLettaAgentId(supabase, userId);
  if (existing) return existing;

  const c = config();
  const body: Record<string, unknown> = { name: `nexora-user-${userId.slice(0, 12)}`, description: "Mémoire persistante privée de Nexo pour un utilisateur Nexora", tags: ["nexora", "private-memory"] };
  if (c.model) body.model = c.model;
  const created = await lettaFetch("/v1/agents", { method: "POST", body: JSON.stringify(body) });
  const agentId = String(created?.id || created?.agent_id || "");
  if (!agentId) throw new Error("Letta n'a pas retourné d'identifiant d'agent.");

  const { error } = await supabase.from("lia_memory_agents").upsert({ user_id: userId, provider: "letta", external_agent_id: agentId, status: "active" }, { onConflict: "user_id,provider" });
  if (error) throw new Error(error.message);
  return agentId;
}

export async function rememberWithLetta(supabase: SupabaseClient, userId: string, text: string): Promise<LettaMemory> {
  const clean = text.trim().slice(0, 4000);
  if (!clean) throw new Error("Mémoire vide.");
  try {
    const agentId = await ensureLettaAgent(supabase, userId);
    const response = await lettaFetch(`/v1/agents/${encodeURIComponent(agentId)}/messages`, { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: clean }], streaming: false }) });
    return { agentId, source: "letta", response: extractText(response) };
  } catch {
    return { agentId: "", source: "supabase-fallback" };
  }
}

export async function recallWithLetta(supabase: SupabaseClient, userId: string, query: string): Promise<LettaMemory> {
  const clean = query.trim().slice(0, 2000);
  if (!clean) return { agentId: "", source: "supabase-fallback" };
  try {
    const agentId = await ensureLettaAgent(supabase, userId);
    const response = await lettaFetch(`/v1/agents/${encodeURIComponent(agentId)}/messages`, { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: `Récupère uniquement les souvenirs pertinents pour cette demande. Ne donne aucun secret ni identifiant technique. Demande: ${clean}` }], streaming: false }) });
    return { agentId, source: "letta", response: extractText(response) };
  } catch {
    return { agentId: "", source: "supabase-fallback" };
  }
}

function extractText(payload: any): string | undefined {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const texts = messages.flatMap((m: any) => Array.isArray(m?.content) ? m.content : [m?.content]).map((x: any) => typeof x === "string" ? x : x?.text).filter(Boolean);
  return texts.length ? String(texts[texts.length - 1]).slice(0, 8000) : undefined;
}
