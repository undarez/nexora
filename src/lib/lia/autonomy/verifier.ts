export type ObservationCheck = {
  key: string;
  expected: boolean;
  observed: boolean;
  detail: string;
};

function inspectValue(value: unknown, path = "root", issues: string[] = []): void {
  if (typeof value === "number" && !Number.isFinite(value)) issues.push(`${path}: valeur numérique non finie`);
  if (Array.isArray(value)) {
    value.slice(0, 200).forEach((item, index) => inspectValue(item, `${path}[${index}]`, issues));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).slice(0, 200).forEach(([key, item]) => inspectValue(item, `${path}.${key}`, issues));
  }
}

export function verifyReadOnlyObservation(result: unknown, previous: Array<{ tool: string; ok: boolean; summary?: string }>): { passed: boolean; checks: ObservationCheck[]; confidence: number } {
  const issues: string[] = [];
  inspectValue(result, "result", issues);
  const serializable = (() => { try { JSON.stringify(result); return true; } catch { return false; } })();
  const nonEmpty = result !== null && result !== undefined && (typeof result !== "object" || Object.keys(result as Record<string, unknown>).length > 0);
  const checks: ObservationCheck[] = [
    { key: "non_empty", expected: true, observed: nonEmpty, detail: nonEmpty ? "Observation non vide." : "Observation vide." },
    { key: "serializable", expected: true, observed: serializable, detail: serializable ? "Observation sérialisable." : "Observation non sérialisable." },
    { key: "finite_numbers", expected: true, observed: issues.length === 0, detail: issues[0] ?? "Valeurs numériques cohérentes." },
    { key: "history_available", expected: true, observed: true, detail: `Historique disponible: ${previous.length} observations.` },
  ];
  const passed = checks.every(check => check.expected === check.observed);
  const confidence = Math.max(0, Math.min(1, checks.filter(check => check.expected === check.observed).length / checks.length));
  return { passed, checks, confidence };
}

export function summarizeVerifiedObservation(result: unknown, max = 1600): string {
  try { return JSON.stringify(result).slice(0, max); } catch { return String(result).slice(0, max); }
}
