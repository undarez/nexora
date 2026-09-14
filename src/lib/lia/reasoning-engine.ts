import { liaChat, type LiaProviderMessage } from "@/lib/lia/provider";

export type ReasoningTool = string;

export type ReasoningDecision = {
  action: "use_tool" | "finish" | "needs_human";
  tool: string | null;
  objective: string;
  questions: string[];
  checks: string[];
  confidence: number;
};

export type ReasoningMemory = {
  facts: string[];
  openQuestions: string[];
  completedTools: string[];
  failedTools: string[];
  checks: string[];
};

const DEFAULT_DECISION: ReasoningDecision = {
  action: "finish",
  tool: null,
  objective: "Terminer avec les observations déjà disponibles.",
  questions: [],
  checks: ["Ne pas conclure au-delà des données observées."],
  confidence: 0.5,
};

function cleanStringList(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 500)).slice(0, max);
}

function parseDecision(raw: string, allowedTools: Set<string>): ReasoningDecision | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? raw;
  const first = fenced.indexOf("{");
  const last = fenced.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  try {
    const parsed = JSON.parse(fenced.slice(first, last + 1)) as Record<string, unknown>;
    const action = parsed.action === "use_tool" || parsed.action === "finish" || parsed.action === "needs_human" ? parsed.action : "finish";
    const tool = typeof parsed.tool === "string" && allowedTools.has(parsed.tool) ? parsed.tool : null;
    if (action === "use_tool" && !tool) return null;
    const confidence = typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    return {
      action,
      tool,
      objective: typeof parsed.objective === "string" ? parsed.objective.slice(0, 500) : "Poursuivre l'analyse avec les données disponibles.",
      questions: cleanStringList(parsed.questions),
      checks: cleanStringList(parsed.checks),
      confidence,
    };
  } catch {
    return null;
  }
}

export async function chooseNextReasoningStep(input: {
  goal: string;
  task: string;
  allowedTools: string[];
  memory: ReasoningMemory;
  observations: Array<{ tool: string; ok: boolean; summary?: string }>;
  remainingSteps: number;
}): Promise<ReasoningDecision> {
  const allowed = new Set(input.allowedTools);
  if (input.remainingSteps <= 0 || allowed.size === 0) return DEFAULT_DECISION;

  const system = [
    "Tu es le moteur de décision gouverné de LIA, une IA financière prudente.",
    "Tu dois choisir UNE prochaine action à partir des données déjà observées.",
    "Tu ne peux utiliser que les outils fournis dans allowedTools.",
    "Les outils sont en lecture seule dans cette boucle : aucune mutation financière n'est autorisée.",
    "Ne donne jamais une chaîne de pensée détaillée. Retourne uniquement un objet JSON compact décrivant la décision, les questions ouvertes et les vérifications utiles.",
    "Tu dois privilégier une nouvelle observation si une information manque réellement. Termine si les preuves sont suffisantes.",
    "Format JSON strict : {action:'use_tool'|'finish'|'needs_human',tool:string|null,objective:string,questions:string[],checks:string[],confidence:number}",
  ].join("\n");

  const user = JSON.stringify({
    goal: input.goal.slice(0, 2000),
    task: input.task,
    allowedTools: input.allowedTools,
    remainingSteps: input.remainingSteps,
    workingMemory: input.memory,
    observations: input.observations.slice(-8),
  });

  const messages: LiaProviderMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  try {
    const result = await liaChat(messages);
    const parsed = parseDecision(result.content, allowed);
    if (parsed) return parsed;
  } catch {
    // Deterministic fallback below keeps the autonomous loop safe and bounded.
  }

  const nextTool = input.allowedTools.find((tool) => !input.memory.completedTools.includes(tool) && !input.memory.failedTools.includes(tool)) ?? null;
  if (!nextTool) return DEFAULT_DECISION;
  return {
    action: "use_tool",
    tool: nextTool,
    objective: `Obtenir une observation complémentaire avec ${nextTool}.`,
    questions: ["Une donnée importante manque-t-elle encore pour répondre à l'objectif ?"],
    checks: ["Vérifier la cohérence de l'observation avec les données précédentes."],
    confidence: 0.45,
  };
}
