export type HarnessLimits = {
  maxSteps: number;
  maxToolCalls: number;
  maxWallTimeMs: number;
  maxRepeatedCalls: number;
};

export type HarnessStep = {
  index: number;
  kind: "tool" | "model" | "result" | "blocked";
  name?: string;
  ok?: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  fingerprint?: string;
  error?: string;
};

export type HarnessState = {
  startedAt: string;
  steps: HarnessStep[];
  toolCalls: number;
  status: "running" | "completed" | "blocked" | "failed";
  reason?: string;
};

const DEFAULTS: HarnessLimits = {
  maxSteps: 8,
  maxToolCalls: 8,
  maxWallTimeMs: 120_000,
  maxRepeatedCalls: 1,
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}

export function resolveHarnessLimits(input?: Partial<HarnessLimits>): HarnessLimits {
  return {
    maxSteps: clampInt(input?.maxSteps, DEFAULTS.maxSteps, 1, 20),
    maxToolCalls: clampInt(input?.maxToolCalls, DEFAULTS.maxToolCalls, 1, 20),
    maxWallTimeMs: clampInt(input?.maxWallTimeMs, DEFAULTS.maxWallTimeMs, 5_000, 300_000),
    maxRepeatedCalls: clampInt(input?.maxRepeatedCalls, DEFAULTS.maxRepeatedCalls, 0, 2),
  };
}

export class AgentHarness {
  readonly limits: HarnessLimits;
  readonly state: HarnessState;
  private readonly fingerprints = new Map<string, number>();

  constructor(limits?: Partial<HarnessLimits>) {
    this.limits = resolveHarnessLimits(limits);
    this.state = {
      startedAt: new Date().toISOString(),
      steps: [],
      toolCalls: 0,
      status: "running",
    };
  }

  private elapsedMs() {
    return Date.now() - Date.parse(this.state.startedAt);
  }

  guard(nextKind: "tool" | "model", fingerprint?: string) {
    if (this.state.status !== "running") return { allowed: false as const, reason: "Harness arrêté." };
    if (this.state.steps.length >= this.limits.maxSteps) return this.block("Budget d'étapes atteint.");
    if (this.elapsedMs() >= this.limits.maxWallTimeMs) return this.block("Budget temps atteint.");
    if (nextKind === "tool") {
      if (this.state.toolCalls >= this.limits.maxToolCalls) return this.block("Budget d'outils atteint.");
      if (fingerprint) {
        const count = (this.fingerprints.get(fingerprint) ?? 0) + 1;
        this.fingerprints.set(fingerprint, count);
        if (count > this.limits.maxRepeatedCalls) return this.block("Répétition d'appel détectée.");
      }
    }
    return { allowed: true as const };
  }

  record(input: Omit<HarnessStep, "index">) {
    this.state.steps.push({ index: this.state.steps.length + 1, ...input });
    if (input.kind === "tool") this.state.toolCalls += 1;
  }

  complete(status: Exclude<HarnessState["status"], "running">, reason?: string) {
    this.state.status = status;
    if (reason) this.state.reason = reason.slice(0, 500);
  }

  summary() {
    return {
      status: this.state.status,
      reason: this.state.reason,
      steps: this.state.steps,
      toolCalls: this.state.toolCalls,
      elapsedMs: this.elapsedMs(),
      limits: this.limits,
    };
  }

  private block(reason: string) {
    this.complete("blocked", reason);
    return { allowed: false as const, reason };
  }
}
