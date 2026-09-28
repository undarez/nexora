import type { SupabaseClient } from "@supabase/supabase-js";
import {
  advanceGoalLifecycle,
  createGoalLifecycle,
  persistGoalLifecycle,
  type LiaGoalLifecycle,
} from "@/lib/lia/goal-lifecycle";
import {
  getOrCreateCognitiveSession,
  touchCognitiveSession,
  recordCognitiveSessionTurn,
  updateCognitiveSessionContext,
  type LiaCognitiveSession,
} from "@/lib/lia/cognitive-session";
import {
  detectExplicitRelationalFeedback,
  recordExplicitRelationalFeedback,
} from "@/lib/lia/relational-learning";

type ChatHistoryMessage = { role: "user" | "assistant"; content: string };

export type LiaSessionGoalState = {
  cognitiveSession: LiaCognitiveSession | null;
  goalLifecycle: LiaGoalLifecycle | null;
  requestedLoopRunId: string | null;
  sessionParentLoopRunId: string | null;
  sessionTurnIndex: number;
  history: ChatHistoryMessage[];
};

export async function initializeLiaSessionGoalState(args: {
  supabase: SupabaseClient;
  userId: string;
  requestedSessionId: string | null;
  requestedLoopRunId: string | null;
  history: ChatHistoryMessage[];
}) {
  let cognitiveSession: LiaCognitiveSession | null = null;
  let requestedLoopRunId = args.requestedLoopRunId;
  let history = [...args.history];
  let sessionParentLoopRunId: string | null = null;
  let sessionTurnIndex = 1;

  try {
    cognitiveSession = await getOrCreateCognitiveSession(args.supabase, args.userId, args.requestedSessionId);
    sessionParentLoopRunId = cognitiveSession.activeLoopRunId;
    sessionTurnIndex = cognitiveSession.turnCount + 1;
    if (!requestedLoopRunId && cognitiveSession.activeLoopRunId) requestedLoopRunId = cognitiveSession.activeLoopRunId;

    if (history.length === 0 && cognitiveSession.lastUserMessage) {
      history = ([
        { role: "user" as const, content: cognitiveSession.lastUserMessage.slice(0, 3000) },
        ...(cognitiveSession.lastAssistantMessage
          ? [{ role: "assistant" as const, content: cognitiveSession.lastAssistantMessage.slice(0, 3000) }]
          : []),
      ] as ChatHistoryMessage[]).slice(-8);
    }
  } catch (error) {
    console.warn(
      "Session cognitive indisponible; poursuite sans session:",
      error instanceof Error ? error.message : error,
    );
  }

  return {
    cognitiveSession,
    requestedLoopRunId,
    sessionParentLoopRunId,
    sessionTurnIndex,
    history,
  };
}

export async function createOrResumeLiaGoal(args: {
  supabase: SupabaseClient;
  userId: string;
  requestedLoopRunId: string | null;
  requestedQuestion: string;
  task: string;
  transactionCount: number;
  cognitiveSession: LiaCognitiveSession | null;
}) {
  let loopRunId: string | null = null;
  let goalLifecycle: LiaGoalLifecycle | null = null;

  if (args.requestedLoopRunId) {
    const { data: resumeRun, error: resumeError } = await args.supabase
      .from("agent_loop_runs")
      .select("id,status,goal,context")
      .eq("id", args.requestedLoopRunId)
      .eq("user_id", args.userId)
      .single();

    const savedLifecycle = resumeRun?.context?.goal_lifecycle as LiaGoalLifecycle | undefined;
    const resumable =
      resumeRun &&
      !resumeError &&
      (resumeRun.status === "running" || resumeRun.status === "blocked" || resumeRun.status === "needs_human") &&
      savedLifecycle;

    if (!resumable) {
      return {
        loopRunId: null,
        goalLifecycle: null,
        resumeRejected: true,
      } as const;
    }

    loopRunId = String(resumeRun.id);
    goalLifecycle = advanceGoalLifecycle(
      savedLifecycle,
      "understanding",
      "reprendre le contexte et traiter la nouvelle information",
      { completedStep: "resume" },
    );
    await args.supabase
      .from("agent_loop_runs")
      .update({ status: "running", completed_at: null })
      .eq("id", loopRunId)
      .eq("user_id", args.userId);
    await persistGoalLifecycle(args.supabase, loopRunId, goalLifecycle);

    return {
      loopRunId,
      goalLifecycle,
      resumeRejected: false,
    } as const;
  }

  const { startAgentLoop } = await import("@/lib/agents/loop-engine");
  loopRunId = await startAgentLoop(
    args.supabase,
    args.userId,
    args.requestedQuestion,
    "user_request",
    {
      task: args.task,
      transaction_count: args.transactionCount,
      session_id: args.cognitiveSession?.id ?? null,
      parent_loop_run_id: args.cognitiveSession?.activeLoopRunId ?? null,
    },
  );

  let inheritedObjective = args.requestedQuestion;
  if (
    args.cognitiveSession?.context?.active_goal_objective &&
    typeof args.cognitiveSession.context.active_goal_objective === "string"
  ) {
    inheritedObjective = args.cognitiveSession.context.active_goal_objective.slice(0, 2000);
  }

  goalLifecycle = createGoalLifecycle(loopRunId, inheritedObjective);
  await persistGoalLifecycle(args.supabase, loopRunId, goalLifecycle);

  return {
    loopRunId,
    goalLifecycle,
    resumeRejected: false,
  } as const;
}

export async function updateLiaGoalState(args: {
  supabase: SupabaseClient;
  loopRunId: string | null;
  goalLifecycle: LiaGoalLifecycle | null;
  state: Parameters<typeof advanceGoalLifecycle>[1];
  nextAction: string;
  details?: Parameters<typeof advanceGoalLifecycle>[3];
}) {
  if (!args.loopRunId || !args.goalLifecycle) return args.goalLifecycle;
  const next = advanceGoalLifecycle(
    args.goalLifecycle,
    args.state,
    args.nextAction,
    args.details,
  );
  await persistGoalLifecycle(args.supabase, args.loopRunId, next);
  return next;
}

export async function persistLiaSessionTurn(args: {
  supabase: SupabaseClient;
  userId: string;
  cognitiveSession: LiaCognitiveSession | null;
  loopRunId: string | null;
  goalLifecycle: LiaGoalLifecycle | null;
  sessionTurnIndex: number;
  question: string;
  answer: string;
  decision: string | null;
}) {
  if (!args.cognitiveSession) return;

  try {
    await touchCognitiveSession(
      args.supabase,
      args.cognitiveSession.id,
      args.userId,
      args.goalLifecycle?.state === "completed" ? null : args.loopRunId,
      args.question,
      args.answer,
    );
    await recordCognitiveSessionTurn(args.supabase, {
      sessionId: args.cognitiveSession.id,
      userId: args.userId,
      turnIndex: args.sessionTurnIndex,
      loopRunId: args.loopRunId,
      question: args.question,
      answer: args.answer,
      loopStatus: args.goalLifecycle?.state ?? "completed",
      goalState: args.goalLifecycle?.state ?? null,
      progress: args.goalLifecycle?.progress ?? 100,
      decision: args.decision,
    });
    await updateCognitiveSessionContext(args.supabase, args.cognitiveSession.id, args.userId, {
      active_goal_objective: args.goalLifecycle?.objective ?? args.question,
      last_loop_run_id: args.loopRunId,
      last_goal_state: args.goalLifecycle?.state ?? null,
      last_progress: args.goalLifecycle?.progress ?? 100,
      last_decision: args.decision,
    });
  } catch (error) {
    console.warn(
      "Impossible d'actualiser la session cognitive:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function learnExplicitLiaRelationalFeedback(args: {
  supabase: SupabaseClient;
  userId: string;
  message: string;
  consentedPersonalization: boolean;
}) {
  if (!args.consentedPersonalization) return false;

  try {
    const relationalFeedback = detectExplicitRelationalFeedback(args.message);
    if (!relationalFeedback) return false;
    await recordExplicitRelationalFeedback(args.supabase, args.userId, relationalFeedback);
    return true;
  } catch (error) {
    console.warn(
      "Apprentissage relationnel indisponible:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
