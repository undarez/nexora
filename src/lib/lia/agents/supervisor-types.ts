export type LiaMissionTask = {
  id: string;
  intent: string;
  input: string;
  agentId: string;
  skillId: string;
  dependsOn: string[];
};

export type LiaMissionEvidence = {
  taskId: string;
  agentId: string;
  skillId: string;
  status: string;
  verification: unknown;
  output: unknown;
};

export type LiaMissionResult = {
  status: "completed" | "waiting_confirmation" | "failed" | "partial";
  missionId?: string;
  objective: string;
  tasks: LiaMissionTask[];
  evidence: LiaMissionEvidence[];
  replans: Array<{ reason: string; fromTask: string; toSkill: string }>;
  critique: { passed: boolean; reasons: string[] };
  memoryWritten: boolean;
  output: Record<string, unknown>;
};

export type LiaMissionOptions = {
  userAutonomyLevel?: number;
  maxSteps?: number;
  maxReplans?: number;
};
