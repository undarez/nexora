import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { getAgentTool } from "@/lib/agent-runtime/tool-registry";

const SAFE_BASE_TOOLS = new Set([
  "get_financial_snapshot",
  "get_budget_status",
  "get_cashflow",
  "get_wealth_snapshot",
  "get_forecast",
  "search_transactions",
  "search_use_cases",
  "search_skills",
]);

const MAX_STEPS = 5;
const MAX_NAME = 80;

export type DynamicToolStep = {
  tool: string;
  arguments?: Record<string, unknown>;
};

export type DynamicTool = {
  id: string;
  name: string;
  description: string;
  kind: "composite-read";
  schema: Record<string, unknown>;
  steps: DynamicToolStep[];
  status: "candidate" | "active" | "disabled" | "rejected";
};

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, MAX_NAME);
}

function validateStep(step: unknown): DynamicToolStep | null {
  if (!step || typeof step !== "object" || Array.isArray(step)) return null;
  const raw = step as Record<string, unknown>;
  if (typeof raw.tool !== "string" || !SAFE_BASE_TOOLS.has(raw.tool)) return null;
  const definition = getAgentTool(raw.tool);
  if (!definition || definition.risk !== "read") return null;
  const args = raw.arguments;
  if (args !== undefined && (!args || typeof args !== "object" || Array.isArray(args))) return null;
  return { tool: raw.tool, arguments: args as Record<string, unknown> | undefined };
}

/**
 * Creates only declarative composite-read tools. The model cannot inject JS,
 * SQL, shell commands, arbitrary URLs, credentials, or new executable code.
 * Every step must point to an existing read-only server-side tool.
 */
export async function createDynamicReadTool(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; description: string; steps: unknown[]; schema?: Record<string, unknown> },
) {
  const name = normalizeName(input.name);
  if (name.length < 3) throw new Error("Nom d'outil invalide.");
  if (name.startsWith("admin_") || name.startsWith("system_") || name.startsWith("execute_") || name.startsWith("shell_")) {
    throw new Error("Préfixe d'outil réservé.");
  }
  const steps = input.steps.slice(0, MAX_STEPS).map(validateStep);
  if (!steps.length || steps.some((step) => !step)) throw new Error("Un outil autonome doit être composé uniquement d'outils de lecture gouvernés.");

  const schema = input.schema && typeof input.schema === "object" ? input.schema : {
    type: "object", properties: {}, additionalProperties: false,
  };
  if (schema.type !== "object" || schema.additionalProperties !== false) {
    throw new Error("Le schéma d'un outil autonome doit être un objet fermé.");
  }

  const safety = {
    executable_code: false,
    arbitrary_network: false,
    shell: false,
    sql: false,
    writes: false,
    max_steps: MAX_STEPS,
    base_tools: steps.map((step) => step!.tool),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify({ name, description: input.description, schema, steps })).digest("hex");

  const { data, error } = await supabase.from("lia_dynamic_tools").upsert({
    user_id: userId,
    name,
    description: input.description.trim().slice(0, 500),
    kind: "composite-read",
    schema,
    steps,
    status: "active",
    safety: { ...safety, fingerprint },
    created_by: "agent",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,name" }).select("id,name,description,kind,schema,steps,status").single();
  if (error) throw new Error(`Impossible de créer l'outil gouverné : ${error.message}`);
  return data as DynamicTool;
}

export async function listDynamicReadTools(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("lia_dynamic_tools")
    .select("id,name,description,kind,schema,steps,status")
    .eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as DynamicTool[];
}

export async function getDynamicReadTool(supabase: SupabaseClient, userId: string, name: string) {
  const { data, error } = await supabase.from("lia_dynamic_tools")
    .select("id,name,description,kind,schema,steps,status")
    .eq("user_id", userId).eq("name", normalizeName(name)).eq("status", "active").maybeSingle();
  if (error) throw new Error(error.message);
  return data as DynamicTool | null;
}
