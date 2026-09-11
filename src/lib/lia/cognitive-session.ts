import type { SupabaseClient } from "@supabase/supabase-js";

export type LiaCognitiveSession = {
  id: string;
  activeLoopRunId: string | null;
  title: string;
  status: "active" | "paused" | "completed";
  turnCount: number;
  lastUserMessage: string | null;
  lastAssistantMessage: string | null;
  createdAt: string;
  updatedAt: string;
  context: Record<string, any>;
};

function map(row: any): LiaCognitiveSession {
  return {
    id: String(row.id),
    activeLoopRunId: row.active_loop_run_id ? String(row.active_loop_run_id) : null,
    title: String(row.title ?? "Session Nexo"),
    status: row.status,
    turnCount: Number(row.turn_count ?? 0),
    lastUserMessage: row.last_user_message ?? null,
    lastAssistantMessage: row.last_assistant_message ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    context: (row.context && typeof row.context === "object") ? row.context : {},
  };
}

export async function getOrCreateCognitiveSession(supabase: SupabaseClient, userId: string, sessionId?: string | null) {
  if (sessionId) {
    const { data, error } = await supabase.from("lia_cognitive_sessions").select("*").eq("id", sessionId).eq("user_id", userId).single();
    if (!error && data) return map(data);
  }
  const { data, error } = await supabase.from("lia_cognitive_sessions").insert({ user_id: userId }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Impossible de créer la session cognitive.");
  return map(data);
}

export async function touchCognitiveSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  loopRunId: string | null,
  userMessage: string,
  assistantMessage: string,
) {
  const { error } = await supabase.rpc("lia_touch_cognitive_session", {
    p_session_id: sessionId,
    p_user_id: userId,
    p_loop_run_id: loopRunId,
    p_user_message: userMessage,
    p_assistant_message: assistantMessage,
  });
  if (error) throw new Error(error.message);
}

export async function listCognitiveSessions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("lia_cognitive_sessions").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(8);
  if (error) throw new Error(error.message);
  return (data ?? []).map(map);
}

export async function recordCognitiveSessionTurn(
  supabase: SupabaseClient,
  args: { sessionId: string; userId: string; turnIndex: number; loopRunId: string | null; question: string; answer: string; loopStatus: string; goalState: string | null; progress: number; decision: string | null }
) {
  const { error } = await supabase.from("lia_cognitive_session_turns").insert({
    session_id: args.sessionId, user_id: args.userId, turn_index: args.turnIndex,
    loop_run_id: args.loopRunId, question: args.question.slice(0, 2000),
    answer_preview: args.answer.slice(0, 1200), loop_status: args.loopStatus,
    goal_state: args.goalState, progress: Math.max(0, Math.min(100, Math.round(args.progress))), decision: args.decision,
  });
  if (error) throw new Error(error.message);
}

export async function updateCognitiveSessionContext(supabase: SupabaseClient, sessionId: string, userId: string, context: Record<string, unknown>) {
  const { data: current, error: readError } = await supabase.from("lia_cognitive_sessions").select("context").eq("id", sessionId).eq("user_id", userId).single();
  if (readError) throw new Error(readError.message);
  const { error } = await supabase.from("lia_cognitive_sessions").update({ context: { ...(current?.context ?? {}), ...context }, updated_at: new Date().toISOString() }).eq("id", sessionId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
