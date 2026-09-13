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
  usage?: { completion_tokens?: number; prompt_tokens?: number };
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

const SYSTEM_PROMPT = `Tu es NEXORA, un agent financier local et autonome.
Tu dois atteindre l'objectif de l'utilisateur en observant les données autorisées, en vérifiant tes résultats et en avançant par petites étapes.

Règles impératives:
- Utilise les outils lorsque des données réelles sont nécessaires. Ne devine jamais les chiffres.
- Une action autonome doit rester réversible et non critique.
- Tu ne peux ni effectuer de virement, ni modifier un compte bancaire, ni supprimer des données, ni prendre une décision financière critique.
- Si une action nécessite une validation humaine, explique-le et arrête-toi.
- Après chaque outil, analyse son résultat avant de choisir l'étape suivante.
- Termine uniquement lorsque l'objectif est suffisamment traité ou lorsqu'une intervention humaine est nécessaire.
- N'expose jamais les identifiants internes, secrets, tokens ou UUID Supabase.
- Réponds en français, de manière concise et concrète.
`;

function brainConfig() {
  const url = (process.env.NEXORA_BRAIN_API_URL || "").replace(/\/$/, "");
  return {
    url,
    key: process.env.NEXORA_BRAIN_API_KEY || "",
    model: process.env.NEXORA_BRAIN_MODEL || "nexora-lia",
  };
}

function toolSchemas() {
  return AUTONOMOUS_TOOLS.map((name) => {
    const definition = getAgentTool(name);
    if (!definition) throw new Error(`Outil autonome absent: ${name}`);
    const parameters = name === "get_cashflow"
      ? { type: "object", properties: { days: { type: "number", minimum: 1, maximum: 365 } } }
      : name === "search_transactions"
        ? { type: "object", properties: { query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 100 } } }
        : name === "search_use_cases" || name === "search_skills"
          ? { type: "object", properties: { query: { type: "string" }, category: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 20 } } }
          : { type: "object", properties: {} };
    return {
      type: "function",
      function: { name: definition.name, description: definition.description, parameters },
    };
  });
}

async function callBrain(messages: AgentMessage[], signal?: AbortSignal) {
  const config = brainConfig();
  if (!config.url) throw new Error("NEXORA_BRAIN_API_URL n'est pas configuré.");
  const response = await fetch(`${config.url}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: toolSchemas(),
      tool_choice: "auto",
      parallel_tool_calls: false,
      temperature: 0.2,
      max_tokens: 900,
      stream: false,
    }),
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(Number(process.env.NEXORA_BRAIN_TIMEOUT_MS || 120000)),
  });
  const raw = await response.text();
  let payload: BrainResponse = {};
  try { payload = JSON.parse(raw); } catch {}
  if (!response.ok) throw new Error(payload?.choices?.[0]?.message?.content || `NEXORA Brain a refusé la requête (${response.status}).`);
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("NEXORA Brain n'a pas renvoyé de message.");
  return { message, model: payload.model || config.model, usage: payload.usage };
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

export type AutonomousAgentResult = {
  status: "completed" | "needs_human" | "blocked" | "failed";
  answer: string;
  steps: Array<{ step: number; tool?: string; ok?: boolean; model?: string }>;
  model: string;
  iterations: number;
};

export async function runLocalAutonomousAgent(
  supabase: SupabaseClient,
  userId: string,
  objective: string,
  options?: { maxIterations?: number; signal?: AbortSignal },
): Promise<AutonomousAgentResult> {
  const maxIterations = Math.max(1, Math.min(8, Math.floor(options?.maxIterations ?? 5)));
  const messages: AgentMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: objective.slice(0, 4000) },
  ];
  const steps: AutonomousAgentResult["steps"] = [];
  let model = brainConfig().model;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    let result: Awaited<ReturnType<typeof callBrain>>;
    try {
      result = await callBrain(messages, options?.signal);
      model = result.model;
    } catch (error) {
      return {
        status: "failed",
        answer: error instanceof Error ? error.message : "Le cerveau local est indisponible.",
        steps,
        model,
        iterations: iteration,
      };
    }

    const assistant = result.message;
    messages.push({
      role: "assistant",
      content: assistant.content ?? null,
      ...(assistant.tool_calls?.length ? { tool_calls: assistant.tool_calls } : {}),
    });

    if (!assistant.tool_calls?.length) {
      const answer = typeof assistant.content === "string" && assistant.content.trim()
        ? assistant.content.trim()
        : "Objectif traité, mais le cerveau n'a pas fourni de synthèse finale.";
      return { status: "completed", answer, steps, model, iterations: iteration };
    }

    for (const toolCall of assistant.tool_calls.slice(0, 1)) {
      if (!AUTONOMOUS_TOOLS.includes(toolCall.function.name as (typeof AUTONOMOUS_TOOLS)[number])) {
        return {
          status: "blocked",
          answer: `L'outil « ${toolCall.function.name} » n'est pas autorisé en autonomie.`,
          steps,
          model,
          iterations: iteration,
        };
      }

      const args = safeArguments(toolCall.function.arguments);
      try {
        const toolResult = await executeAgentTool(supabase, userId, {
          name: toolCall.function.name,
          arguments: args,
        });
        steps.push({ step: iteration, tool: toolCall.function.name, ok: true, model });
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: compactResult({ ok: true, result: toolResult }) });
      } catch (error) {
        steps.push({ step: iteration, tool: toolCall.function.name, ok: false, model });
        const message = error instanceof Error ? error.message : "Outil indisponible.";
        if (message.includes("validation humaine") || message.includes("human") || message.includes("Approval")) {
          return { status: "needs_human", answer: message, steps, model, iterations: iteration };
        }
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: compactResult({ ok: false, error: message }) });
      }
    }
  }

  return {
    status: "blocked",
    answer: "J'ai atteint la limite de sécurité de la boucle autonome avant de pouvoir conclure. Relance l'objectif pour continuer.",
    steps,
    model,
    iterations: maxIterations,
  };
}
