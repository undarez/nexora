import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFinancialBehaviour } from "@/lib/lia/financial-memory/behaviour";
import { loadStrategyExperiences } from "@/lib/lia/strategy-learning";
import { chooseContextualStrategy } from "@/lib/lia/contextual-strategy-memory";

type SupervisorTrigger = "user_request" | "scheduled" | "proactive" | "goal" | "autopilot";

export type SupervisorContext = {
  objective: string;
  triggerType: SupervisorTrigger;
  behaviour: Awaited<ReturnType<typeof loadFinancialBehaviour>>;
  strategy?: string;
  strategyHistoryCount: number;
  governance: {
    bounded: true;
    maxSteps: number;
    maxReplans: number;
    maxRetriesPerStep: number;
    knowledgeIsNotAuthorization: true;
    behaviourIsNotAuthorization: true;
  };
};

const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(n)));

export async function buildFinancialSupervisorContext(args: {
  supabase: SupabaseClient;
  userId: string;
  objective: string;
  triggerType?: SupervisorTrigger;
  allowedStrategies?: string[];
}): Promise<SupervisorContext> {
  const behaviour = await loadFinancialBehaviour(args.supabase, args.userId);
  const allowed = args.allowedStrategies?.filter(Boolean).slice(0, 20) ?? [];
  let strategy: string | undefined;
  let strategyHistoryCount = 0;
  if (allowed.length) {
    const experiences = await loadStrategyExperiences({ supabase: args.supabase, userId: args.userId, goalKey: args.objective, limit: 100 });
    strategyHistoryCount = experiences.length;
    strategy = chooseContextualStrategy(experiences, allowed, {
      finance: true,
      objectiveType: "financial",
      action: false,
    });
  }
  return {
    objective: args.objective.trim().slice(0, 500),
    triggerType: args.triggerType ?? "user_request",
    behaviour,
    strategy,
    strategyHistoryCount,
    governance: {
      bounded: true,
      maxSteps: 5,
      maxReplans: 5,
      maxRetriesPerStep: 3,
      knowledgeIsNotAuthorization: true,
      behaviourIsNotAuthorization: true,
    },
  };
}

export async function createFinancialSupervisorRun(args: {
  supabase: SupabaseClient;
  userId: string;
  objective: string;
  triggerType?: SupervisorTrigger;
  allowedStrategies?: string[];
  maxSteps?: number;
}) {
  const context = await buildFinancialSupervisorContext(args);
  const { data, error } = await args.supabase.rpc("lia_supervisor_record_run", {
    p_user_id: args.userId,
    p_trigger_type: context.triggerType,
    p_objective: context.objective,
    p_context: context,
    p_plan: { strategy: context.strategy ?? null, strategy_history_count: context.strategyHistoryCount },
    p_max_steps: clampInt(args.maxSteps ?? 5, 1, 50),
  });
  if (error) throw new Error(`supervisor_run_failed:${error.message}`);
  return { id: String(data), context };
}
