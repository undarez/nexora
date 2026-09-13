import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAgentTool } from "@/lib/agent-runtime/executor";
import { getAgentTool } from "@/lib/agent-runtime/tool-registry";

type AgentMessage =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type BrainResponse = {
  choices?: Array<{
    message?: { role?: "assistant"; content?: string | null; tool_calls?: ToolCall[] };
  }>;
  model?: string;
  usage?: { completion_tokens?: number; prompt_tokens?: number; total_tokens?: number };
};

const AUTONOMOUS_TOOLS = [
  "get_financial_snapshot",
  "get_budget_status",
  "get_cashflow",
  "get_wealth_snapshot",
  "get_forecast",
  "search_transactions",
  "search_use_cases",
  "search_skills",
  "learn_use_case",
  "learn_skill",
  "save_financial_insight",
] as const;

type AutonomousToolName = (typeof AUTONOMOUS_TOOLS)[number];

const SYSTEM_PROMPT = `Tu es NEXORA, l'agent financier autonome de Nexora.
Tu dois atteindre l'objectif de l'utilisateur en observant les données autorisées, en vérifiant tes résultats et en avançant par petites étapes.

Règles impératives:
- Utilise les outils lorsque des données réelles sont nécessaires. Ne devine jamais les chiffres.
- Une action autonome doit rester réversible et non critique.
- Tu ne peux ni effectuer de virement, ni modifier un compte bancaire, ni supprimer des données, ni prendre une décision financière critique.
- Les apprentissages (Use Case/Skill) restent des candidats et ne deviennent jamais actifs automatiquement.
- Si une action nécessite une validation humaine, explique-le et arrête-toi.
- Après chaque outil, analyse son résultat avant de choisir l'étape suivante.
- Évite de répéter exactement le même outil avec les mêmes arguments sans raison nouvelle.
- Termine uniquement lorsque l'objectif est suffisamment traité ou lorsqu'une intervention humaine est nécessaire.
- N'expose jamais les identifiants internes, secrets, tokens ou UUID Supabase.
- Réponds en français, de manière concise, concrète et fondée sur les données.
`;

function brainConfig() {
  const url = (process.env.NEXORA_BRAIN_API_URL || "").replace(/\/$/, "");
  return {
    url,
    key: process.env.NEXORA_BRAIN_API_KEY || "",
    model: process.env.NEXORA_BRAIN_MODEL || "nexora-lia",
  };
}

const emptyObject = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

function toolParameters(name: AutonomousToolName) {
  switch (name) {
    case "get_cashflow":
      return { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 365, description: "Nombre de jours à analyser." } }, additionalProperties: false };
    case "search_transactions":
      return { type: "object", properties: { query: { type: "string", maxLength: 100, description: "Libellé ou terme à rechercher." }, limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false };
    case "search_use_cases":
    case "search_skills":
      return { type: "object", properties: { query: { type: "string", maxLength: 200 }, category: { type: "string", maxLength: 60 }, limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false };
    case "learn_use_case":
      return {
        type: "object",
        required: ["name", "description", "objective", "trigger", "required_skills", "success_criteria", "verification_rules"],
        properties: {
          name: { type: "string", minLength: 3, maxLength: 120 }, description: { type: "string", minLength: 10, maxLength: 500 }, category: { type: "string", maxLength: 60 },
          objective: { type: "string", minLength: 5, maxLength: 1000 }, trigger: { type: "string", minLength: 5, maxLength: 500 },
          required_context: { type: "array", items: { type: "string", maxLength: 200 }, maxItems: 20 }, required_skills: { type: "array", items: { type: "string", maxLength: 120 }, minItems: 1, maxItems: 20 },
          suggested_tools: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 20 }, risk_class: { type: "string", enum: ["read", "recommendation", "write-sensitive", "critical"] },
          minimum_autonomy: { type: "integer", minimum: 0, maximum: 3 }, human_approval_required: { type: "boolean" },
          success_criteria: { type: "array", items: { type: "string", maxLength: 300 }, minItems: 1, maxItems: 20 }, verification_rules: { type: "array", items: { type: "string", maxLength: 300 }, minItems: 1, maxItems: 20 },
        },
        additionalProperties: false,
      };
    case "learn_skill":
      return {
        type: "object",
        required: ["name", "description", "procedure"],
        properties: {
          name: { type: "string", minLength: 3, maxLength: 120 }, description: { type: "string", minLength: 10, maxLength: 500 }, category: { type: "string", maxLength: 60 },
          procedure: { type: "string", minLength: 20, maxLength: 12000 }, trigger_context: { type: "object", additionalProperties: true }, expected_result: { type: "string", maxLength: 1000 },
          verification_steps: { type: "array", items: { type: "string", maxLength: 300 }, maxItems: 10 }, failure_modes: { type: "array", items: { type: "string", maxLength: 300 }, maxItems: 10 },
          source_refs: { type: "array", items: { type: "string", maxLength: 200 }, maxItems: 10 }, correction: { type: "string", maxLength: 5000 },
        },
        additionalProperties: false,
      };
    case "save_financial_insight":
      return {
        type: "object",
        required: ["title", "content"],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 200 }, content: { type: "string", minLength: 10, maxLength: 5000 }, category: { type: "string", maxLength: 80 },
          severity: { type: "string", enum: ["info", "low", "medium", "high"] }, evidence: { type: "array", items: { type: "string", maxLength: 500 }, maxItems: 10 },
        },
        additionalProperties: false,
      };
    default:
      return emptyObject;
  }
}

function toolSchemas() {
  return AUTONOMOUS_TOOLS.map((name) => {
    const definition = getAgentTool(name);
    if (!definition) throw new Error(`Outil autonome absent: ${name}`);
    return { type: "function", function: { name: definition.name, description: definition.description, parameters: toolParameters(name) } };
  });
}

async function callBrain(messages: AgentMessage[], signal?: AbortSignal) {
  const config = brainConfig();
  if (!config.url) throw new Error("NEXORA_BRAIN_API_URL n'est pas configuré.");
  const timeout = Number(process.env.NEXORA_BRAIN_TIMEOUT_MS || 120000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeout) ? Math.max(5000, timeout) : 120000);
  const relayAbort = () => controller.abort();
  signal?.addEventListener("abort", relayAbort, { once: true });
  try {
    const response = await fetch(`${config.url}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}) },
      body: JSON.stringify({ model: config.model, messages, tools: toolSchemas(), tool_choice: "auto", parallel_tool_calls: false, temperature: 0.2, max_tokens: 900, stream: false }),
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload: BrainResponse = {};
    try { payload = JSON.parse(raw); } catch { /* handled below */ }
    if (!response.ok) {
      const detail = typeof payload.choices?.[0]?.message?.content === "string" ? payload.choices[0].message.content : `HTTP ${response.status}`;
      throw new Error(`NEXORA Brain a refusé la requête (${detail}).`);
    }
    const message = payload.choices?.[0]?.message;
    if (!message) throw new Error("NEXORA Brain n'a pas renvoyé de message.");
    return { message, model: payload.model || config.model, usage: payload.usage };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", relayAbort);
  }
}

function safeArguments(raw: string) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function compactResult(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 7000 ? `${serialized.slice(0, 7000)}…` : serialized;
  } catch {
    return JSON.stringify({ ok: false, error: "Résultat non sérialisable." });
  }
}

function normalizeToolCall(call: ToolCall) {
  if (!call || call.type !== "function" || !call.id || !call.function?.name) return null;
  const name = call.function.name as AutonomousToolName;
  if (!AUTONOMOUS_TOOLS.includes(name)) return null;
  return { ...call, function: { ...call.function, name } };
}

export type AutonomousAgentResult = {
  status: "completed" | "needs_human" | "blocked" | "failed";
  answer: string;
  steps: Array<{ step: number; tool?: string; ok?: boolean; model?: string }>;
  model: string;
  iterations: number;
};

type AgentRunRecord = { id: string };

async function startRun(supabase: SupabaseClient, userId: string, objective: string, model: string) {
  try {
    const { data, error } = await supabase.from("agent_runs").insert({
      user_id: userId,
      agent: "nexora-autonomous",
      agent_key: "nexora-autonomous",
      model,
      task_type: "autonomous_agent",
      input_summary: { objective: objective.slice(0, 1000) },
      input_context: { objective: objective.slice(0, 1000), max_context: "financial-tools-only" },
      status: "running",
    }).select("id").single();
    if (error || !data) return null;
    return data as AgentRunRecord;
  } catch {
    return null;
  }
}

async function finishRun(supabase: SupabaseClient, runId: string | null, result: AutonomousAgentResult, startedAt: number) {
  if (!runId) return;
  try {
    await supabase.from("agent_runs").update({
      status: result.status,
      model: result.model,
      output_summary: { answer: result.answer.slice(0, 3000), steps: result.steps },
      output: { answer: result.answer.slice(0, 5000), steps: result.steps, iterations: result.iterations },
      duration_ms: Math.max(0, Date.now() - startedAt),
      completed_at: new Date().toISOString(),
      error_message: result.status === "failed" ? result.answer.slice(0, 1000) : null,
    }).eq("id", runId).eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
  } catch {
    // Telemetry must never make the financial agent fail.
  }
}

export async function runLocalAutonomousAgent(
  supabase: SupabaseClient,
  userId: string,
  objective: string,
  options?: { maxIterations?: number; signal?: AbortSignal },
): Promise<AutonomousAgentResult> {
  const cleanObjective = objective.trim().slice(0, 4000);
  const baseModel = brainConfig().model;
  if (!cleanObjective) return { status: "failed", answer: "Un objectif est nécessaire pour lancer l'agent.", steps: [], model: baseModel, iterations: 0 };
  const maxIterations = Math.max(1, Math.min(8, Math.floor(options?.maxIterations ?? 5)));
  const startedAt = Date.now();
  const run = await startRun(supabase, userId, cleanObjective, baseModel);
  const runId = run?.id ?? null;
  const messages: AgentMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: cleanObjective },
  ];
  const steps: AutonomousAgentResult["steps"] = [];
  let model = baseModel;
  const seenCalls = new Set<string>();

  const complete = async (result: AutonomousAgentResult) => {
    await finishRun(supabase, runId, result, startedAt);
    return result;
  };

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    if (options?.signal?.aborted) return complete({ status: "failed", answer: "La boucle autonome a été interrompue.", steps, model, iterations: iteration - 1 });
    let result: Awaited<ReturnType<typeof callBrain>>;
    try {
      result = await callBrain(messages, options?.signal);
      model = result.model;
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "Le cerveau Nexora a dépassé son délai ou la requête a été interrompue."
        : error instanceof Error ? error.message : "Le cerveau local est indisponible.";
      return complete({ status: "failed", answer: message, steps, model, iterations: iteration });
    }

    const assistant = result.message;
    const rawCalls = assistant.tool_calls ?? [];
    const toolCalls = rawCalls.map(normalizeToolCall);
    if (rawCalls.length > 0 && toolCalls.some((call) => call === null)) {
      return complete({ status: "blocked", answer: "Le cerveau a demandé un outil qui n'est pas autorisé par le runtime Nexora.", steps, model, iterations: iteration });
    }
    messages.push({ role: "assistant", content: assistant.content ?? null, ...(toolCalls.length ? { tool_calls: toolCalls as ToolCall[] } : {}) });

    if (!toolCalls.length) {
      const answer = typeof assistant.content === "string" && assistant.content.trim() ? assistant.content.trim() : "Objectif traité, mais le cerveau n'a pas fourni de synthèse finale.";
      return complete({ status: "completed", answer, steps, model, iterations: iteration });
    }

    const toolCall = toolCalls[0] as ToolCall;
    const fingerprint = `${toolCall.function.name}:${toolCall.function.arguments || "{}"}`;
    if (seenCalls.has(fingerprint)) return complete({ status: "blocked", answer: "La boucle a détecté une répétition exacte d'une action et s'est arrêtée par sécurité.", steps, model, iterations: iteration });
    seenCalls.add(fingerprint);

    const args = safeArguments(toolCall.function.arguments);
    try {
      const toolResult = await executeAgentTool(supabase, userId, { name: toolCall.function.name, arguments: args }, { runId });
      steps.push({ step: iteration, tool: toolCall.function.name, ok: true, model });
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: compactResult({ ok: true, result: toolResult }) });
    } catch (error) {
      steps.push({ step: iteration, tool: toolCall.function.name, ok: false, model });
      const message = error instanceof Error ? error.message : "Outil indisponible.";
      if (message.includes("validation humaine") || message.includes("human") || message.includes("Approval") || message.includes("REQUIRE_APPROVAL")) {
        return complete({ status: "needs_human", answer: message, steps, model, iterations: iteration });
      }
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: compactResult({ ok: false, error: message }) });
    }
  }

  return complete({ status: "blocked", answer: "J'ai atteint la limite de sécurité de la boucle autonome avant de pouvoir conclure. Relance l'objectif pour continuer.", steps, model, iterations: maxIterations });
}
