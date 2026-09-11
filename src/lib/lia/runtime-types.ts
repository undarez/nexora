export type LiaRuntimeType = "agent" | "stop" | "curator" | "cron";

export type LiaRuntimeStatus = "ready" | "running" | "paused" | "stopped" | "blocked" | "completed" | "failed";

export type LiaRuntimeEvent =
  | "agent.started"
  | "agent.completed"
  | "agent.failed"
  | "stop.requested"
  | "stop.accepted"
  | "stop.denied"
  | "curator.status"
  | "curator.started"
  | "curator.completed"
  | "cron.scheduled"
  | "cron.started"
  | "cron.completed"
  | "cron.failed"
  | "cron.paused";

export type LiaRuntimeDescriptor = {
  type: LiaRuntimeType;
  status: LiaRuntimeStatus;
  purpose: string;
  canExecuteFinancialAction: boolean;
  requiresPolicyGate: boolean;
  requiresHumanApproval: boolean;
};

export const LIA_RUNTIME_DESCRIPTORS: Record<LiaRuntimeType, LiaRuntimeDescriptor> = {
  agent: {
    type: "agent",
    status: "ready",
    purpose: "Exécuter une boucle cognitive orientée objectif.",
    canExecuteFinancialAction: false,
    requiresPolicyGate: true,
    requiresHumanApproval: true,
  },
  stop: {
    type: "stop",
    status: "ready",
    purpose: "Arrêter ou suspendre proprement une boucle ou un job.",
    canExecuteFinancialAction: false,
    requiresPolicyGate: true,
    requiresHumanApproval: false,
  },
  curator: {
    type: "curator",
    status: "ready",
    purpose: "Contrôler, classer et entretenir les skills agent-created.",
    canExecuteFinancialAction: false,
    requiresPolicyGate: true,
    requiresHumanApproval: true,
  },
  cron: {
    type: "cron",
    status: "ready",
    purpose: "Déclencher une boucle à une échéance définie.",
    canExecuteFinancialAction: false,
    requiresPolicyGate: true,
    requiresHumanApproval: true,
  },
};
