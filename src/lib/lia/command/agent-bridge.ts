import type { LiaCommandPlan } from "./types.ts";
import { planSpecialistExecution } from "@/lib/lia/agents/runtime.ts";
export function bridgeCommandToSpecialist(plan:LiaCommandPlan){ return planSpecialistExecution(plan); }
