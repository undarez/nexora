import type { LiaRiskClass } from "@/lib/lia/skills/types.ts";
import type { LiaAgentDefinition } from "./types.ts";

export type LiaAutonomyInputs = {
  agent: LiaAgentDefinition;
  userAutonomyLevel?: number;
  policyCeiling?: number;
  risk: LiaRiskClass;
  permissionGranted: boolean;
  humanGateOpen: boolean;
  budgetRemaining?: number;
};

export type LiaAutonomyDecision = {
  allowed: boolean;
  effectiveLevel: number;
  ceilings: {
    agent: number;
    user: number;
    policy: number;
    risk: number;
    permission: number;
    humanGate: number;
    budget: number;\n    confidence: number;
  };
  reason: string;
};

function clampLevel(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : fallback;
}

function riskCeiling(risk: LiaRiskClass): number {
  if (risk === "critical") return 0;
  if (risk === "write") return 1;
  return 3;
}

/**
 * Computes effective autonomy as the minimum of every independent authority.
 * Autonomy is a ceiling, never a permission grant.
 */
export function calculateEffectiveAutonomy(input: LiaAutonomyInputs): LiaAutonomyDecision {
  const ceilings = {
    agent: clampLevel(input.agent.autonomyLevel, 0),
    user: clampLevel(input.userAutonomyLevel ?? input.agent.autonomyLevel, 0),
    policy: clampLevel(input.policyCeiling ?? 3, 3),
    risk: riskCeiling(input.risk),
    permission: input.permissionGranted ? 3 : 0,
    humanGate: input.humanGateOpen ? 3 : 0,
    budget: input.budgetRemaining === undefined ? 3 : Math.max(0, Math.floor(input.budgetRemaining)),\n    confidence: input.confidence === undefined ? 3 : input.confidence < 70 ? 0 : input.confidence < 85 ? 1 : input.confidence < 95 ? 2 : 3,
  };
  const effectiveLevel = Math.min(...Object.values(ceilings));

  let reason = "Autonomie calculée par le plafond le plus restrictif.";
  if (!input.permissionGranted) reason = "Permission requise absente.";
  else if (!input.humanGateOpen) reason = "Human Gate fermé.";
  else if (input.risk === "critical") reason = "Risque critique : autonomie opérationnelle interdite.";
  else if (effectiveLevel === 0) reason = "Aucun niveau d'autonomie opérationnelle disponible.";

  return { allowed: effectiveLevel > 0, effectiveLevel, ceilings, reason };
}
