import { deterministicLiaAnalysis } from "@/lib/lia/deterministic-engine";
import { AGENT_TASK_LABELS, type AgentTask } from "@/lib/agents/prompts";

export type WorkerTask = Exclude<AgentTask, "financial_analysis">;

export type AgentWorkerResult = {
  task: WorkerTask;
  label: string;
  status: "completed" | "error";
  content: string;
  model: string;
  durationMs: number;
  error?: string;
};

export type FinancialContext = Record<string, unknown>;

const CORE_WORKERS: WorkerTask[] = ["budget", "cashflow", "wealth"];

function needsBankingSpecialist(question: string) {
  return /banque|bancaire|open banking|openbanking|agrégation|connexion bancaire|compte bancaire|transactions bancaires|fournisseur bancaire|fournisseur open banking|tink|powens|finary|stripe financial connections/i.test(question);
}


async function runWorker(task: WorkerTask, question: string, context: FinancialContext): Promise<AgentWorkerResult> {
  const startedAt = Date.now();
  const result = deterministicLiaAnalysis(question, context as Parameters<typeof deterministicLiaAnalysis>[1], task);
  return {
    task,
    label: AGENT_TASK_LABELS[task],
    status: "completed",
    content: result.content,
    model: result.model,
    durationMs: Date.now() - startedAt,
  };
}

export async function runFinancialOrchestration(question: string, context: FinancialContext) {
  const selectedWorkers: WorkerTask[] = needsBankingSpecialist(question)
    ? [...CORE_WORKERS, "banking"]
    : CORE_WORKERS;
  const workers = await Promise.all(selectedWorkers.map((task) => runWorker(task, question, context)));
  const successful = workers.filter((worker) => worker.status === "completed");

  if (successful.length === 0) {
    throw new Error("Aucun sous-agent financier n'a pu terminer son analyse.");
  }

  const synthesisStartedAt = Date.now();
  const synthesis = deterministicLiaAnalysis(question, context as Parameters<typeof deterministicLiaAnalysis>[1], "financial_analysis");
  const model = synthesis.model;
  const analysis = synthesis.content;

  return {
    analysis,
    model,
    workers,
    durationMs: Date.now() - synthesisStartedAt,
  };
}

export function workerTasks() {
  return CORE_WORKERS;
}
