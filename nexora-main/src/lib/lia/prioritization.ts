export type PrioritySignal = {
  id: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  evidence?: Record<string, unknown>;
};

export type PriorityContext = {
  now?: Date;
  userRequested?: boolean;
  hasHumanApprovalPending?: boolean;
};

const severityWeight = { info: 20, warning: 55, danger: 85 } as const;

/** Deterministic, explainable priority. This ranks signals; it never grants permissions. */
export function scoreSignal(signal: PrioritySignal, context: PriorityContext = {}) {
  const evidence = signal.evidence ?? {};
  let score = severityWeight[signal.severity];
  const reasons: string[] = [`gravité=${signal.severity}`];

  const gap = Number(evidence.gap);
  if (Number.isFinite(gap) && gap > 0) {
    const bonus = Math.min(15, Math.round(gap * 30));
    score += bonus;
    reasons.push(`écart trajectoire +${bonus}`);
  }

  const remainingDays = Number(evidence.remainingDays);
  if (Number.isFinite(remainingDays)) {
    if (remainingDays <= 7) { score += 15; reasons.push("échéance ≤ 7 jours +15"); }
    else if (remainingDays <= 30) { score += 8; reasons.push("échéance ≤ 30 jours +8"); }
  }

  const amount = Number(evidence.amount ?? evidence.remaining);
  if (Number.isFinite(amount) && amount > 0) {
    const magnitude = Math.min(10, Math.round(Math.log10(amount + 1) * 3));
    score += magnitude;
    reasons.push(`impact financier +${magnitude}`);
  }

  if (context.userRequested) { score += 10; reasons.push("demande explicite +10"); }
  if (context.hasHumanApprovalPending) { score += 5; reasons.push("validation en attente +5"); }

  return { score: Math.min(100, score), reasons };
}

export function prioritizeSignals<T extends PrioritySignal>(signals: T[], context: PriorityContext = {}) {
  return signals
    .map((signal, index) => ({ signal, index, priority: scoreSignal(signal, context) }))
    .sort((a, b) => b.priority.score - a.priority.score || a.index - b.index)
    .map(({ signal, priority }) => ({ ...signal, priorityScore: priority.score, priorityReasons: priority.reasons }));
}
