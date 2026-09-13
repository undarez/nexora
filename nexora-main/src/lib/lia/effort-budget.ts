export type AnalysisDepth = "quick" | "standard" | "deep";

export type EffortBudget = {
  depth: AnalysisDepth;
  maxSteps: number;
  timeoutMs: number;
  maxEvidenceItems: number;
  maxSkillChars: number;
  maxResponseChars: number;
  stopOnLowConfidence: boolean;
};

export function chooseEffort(input: { severity: "info" | "warning" | "danger"; remainingDays?: number; userRequested?: boolean }): EffortBudget {
  const urgent = Number.isFinite(input.remainingDays) && Number(input.remainingDays) <= 7;
  const deep = input.severity === "danger" || urgent || input.userRequested;
  if (deep) return { depth: "deep", maxSteps: 8, timeoutMs: 120_000, maxEvidenceItems: 30, maxSkillChars: 12_000, maxResponseChars: 12_000, stopOnLowConfidence: true };
  if (input.severity === "warning") return { depth: "standard", maxSteps: 5, timeoutMs: 90_000, maxEvidenceItems: 20, maxSkillChars: 8_000, maxResponseChars: 8_000, stopOnLowConfidence: true };
  return { depth: "quick", maxSteps: 3, timeoutMs: 60_000, maxEvidenceItems: 10, maxSkillChars: 5_000, maxResponseChars: 6_000, stopOnLowConfidence: true };
}

export function validateLiaAnalysis(content: string, maxChars: number) {
  const text = content.trim().slice(0, maxChars);
  const lower = text.toLowerCase();
  const hasFacts = lower.includes("fait") || lower.includes("preuve");
  const hasVerification = lower.includes("vérif") || lower.includes("verif");
  const suspiciousExecution = /\b(exécute|execute|effectue|transfère|transfer|supprime|delete)\b/i.test(text);
  const confidence = hasFacts && hasVerification && !suspiciousExecution ? 80 : hasFacts && !suspiciousExecution ? 65 : 40;
  return { valid: confidence >= 70, confidence, content: text, reasons: [
    hasFacts ? "faits présents" : "faits insuffisamment explicites",
    hasVerification ? "vérification présente" : "vérification insuffisante",
    suspiciousExecution ? "langage d'exécution détecté" : "aucune instruction d'exécution détectée",
  ] };
}

export function deterministicFallback(signal: { title: string; message: string; severity: string }) {
  return `Analyse déterministe de secours.\n\nFaits : ${signal.title}. ${signal.message}\n\nCause : inconnue — aucune cause ne doit être déduite sans preuve.\n\nRisque : niveau ${signal.severity}.\n\nRecommandation : examiner les données sources et ne réaliser aucune action financière sans validation explicite.\n\nVérification suivante : confirmer le signal avec les données financières actuelles.`;
}
