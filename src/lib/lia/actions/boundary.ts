/**
 * V5.08.41 — LIA action/permission boundary.
 *
 * The model can propose and reason, but it is never an authority to mutate
 * financial state. Any future write action must be explicitly allow-listed,
 * human-gated, reversible where possible, and executed by a server route.
 */
export type LiaActionCapability = "read" | "recommend" | "write" | "critical";

export type LiaActionPermission = {
  actionKey: string;
  capability: LiaActionCapability;
  allowedToPlan: boolean;
  requiresHumanApproval: boolean;
  reversible: boolean;
  mutatesFinancialState: boolean;
};

const ACTIONS: Record<string, LiaActionPermission> = {
  create_recommendation: {
    actionKey: "create_recommendation",
    capability: "recommend",
    allowedToPlan: true,
    requiresHumanApproval: true,
    reversible: true,
    mutatesFinancialState: false,
  },
};

export function getLiaActionPermission(actionKey: string): LiaActionPermission | null {
  return ACTIONS[actionKey] ?? null;
}

export function assertLiaActionCanBePlanned(actionKey: string): LiaActionPermission {
  const permission = getLiaActionPermission(actionKey);
  if (!permission || !permission.allowedToPlan) throw new Error("Action LIA non autorisée.");
  return permission;
}

export function assertLiaActionCanBeExecuted(actionKey: string, approved: boolean): LiaActionPermission {
  const permission = getLiaActionPermission(actionKey);
  if (!permission) throw new Error("Action LIA inconnue ou interdite.");
  if (!approved || !permission.requiresHumanApproval) throw new Error("Validation humaine explicite requise.");
  if (permission.mutatesFinancialState) throw new Error("Les écritures financières directes sont interdites par la frontière LIA.");
  return permission;
}

export function listLiaActionPermissions(): LiaActionPermission[] {
  return Object.values(ACTIONS);
}
