import { LIA_AGENT_DEFINITIONS } from "./registry.ts";

export type LiaSpecialistAgent = {
  id: string;
  label: string;
  purpose: string;
  skills: string[];
  autonomous: boolean;
};

/**
 * Compatibility projection for older consumers.
 * Registry.ts is the single source of truth for specialist capabilities and governance.
 * "autonomous" is only a legacy capability flag; actual execution remains governed by
 * policy, permissions, human gates and the multidimensional mission budget.
 */
export const LIA_SPECIALIST_AGENTS: LiaSpecialistAgent[] = LIA_AGENT_DEFINITIONS.map(agent => ({
  id: agent.id,
  label: agent.label,
  purpose: agent.purpose,
  skills: [...agent.skills],
  autonomous: agent.autonomyLevel > 0,
}));
