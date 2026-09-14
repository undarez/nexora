import type { SupabaseClient } from "@supabase/supabase-js";

export type LiaRuntimeControls = {
  ai_enabled: boolean;
  web_research_enabled: boolean;
  banking_refresh_enabled: boolean;
  cron_autonomy_enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

export async function getLiaRuntimeControls(supabase: SupabaseClient): Promise<LiaRuntimeControls> {
  const { data, error } = await supabase.from("lia_runtime_controls")
    .select("ai_enabled,web_research_enabled,banking_refresh_enabled,cron_autonomy_enabled,updated_at,updated_by")
    .eq("id", 1).maybeSingle();
  if (error) throw new Error(`LIA runtime controls unavailable: ${error.message}`);
  return {
    ai_enabled: data?.ai_enabled !== false,
    web_research_enabled: data?.web_research_enabled !== false,
    banking_refresh_enabled: data?.banking_refresh_enabled !== false,
    cron_autonomy_enabled: data?.cron_autonomy_enabled !== false,
    updated_at: data?.updated_at ? String(data.updated_at) : null,
    updated_by: data?.updated_by ? String(data.updated_by) : null,
  };
}

export async function isLiaEnabled(supabase: SupabaseClient) {
  return (await getLiaRuntimeControls(supabase)).ai_enabled;
}
