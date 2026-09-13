import type { SupabaseClient } from "@supabase/supabase-js";
import { LIA_RUNTIME_DESCRIPTORS, type LiaRuntimeType } from "@/lib/lia/runtime-types";

export async function getLiaRuntimeStatus(supabase: SupabaseClient, userId: string) {
  const [{ data: jobs, error: jobsError }, { data: events, error: eventsError }] = await Promise.all([
    supabase.from("lia_runtime_jobs").select("id,runtime_type,name,description,schedule,status,next_run_at,last_run_at,last_status,requires_policy_gate,requires_human_approval,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50),
    supabase.from("lia_runtime_events").select("id,runtime_job_id,runtime_type,event,status,payload,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  if (jobsError) throw new Error(jobsError.message);
  if (eventsError) throw new Error(eventsError.message);

  const counts = { agent: 0, stop: 0, curator: 0, cron: 0 } as Record<LiaRuntimeType, number>;
  for (const job of jobs ?? []) counts[job.runtime_type as LiaRuntimeType] = (counts[job.runtime_type as LiaRuntimeType] ?? 0) + 1;

  return { descriptors: LIA_RUNTIME_DESCRIPTORS, jobs: jobs ?? [], events: events ?? [], counts };
}
