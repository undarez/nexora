/**
 * NEXORA Temporal World Model Kernel v1
 *
 * Adds bounded time semantics to the descriptive world model.
 * It never activates truth, mutates memory, executes tools, or grants financial authority.
 */
import type { KnowledgeNode, KnowledgeEdge } from "./knowledge-graph";
import { buildNexoraWorldModel, type NexoraWorldModel } from "./world-model-kernel";

export type TemporalStatus = "current" | "future" | "expired" | "undated";
export type TemporalNode = {
  nodeId: string;
  observedAt: string | null;
  expiresAt: string | null;
  status: TemporalStatus;
};
export type TemporalRelation = {
  from: string;
  to: string;
  relation: KnowledgeEdge["relation"] | "related_to";
  validFrom: string | null;
  validTo: string | null;
  temporalConfidence: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const dateMs = (value?: string | null) => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
};

function statusFor(node: KnowledgeNode, now: Date): TemporalStatus {
  const observed = dateMs(node.observedAt);
  const expires = dateMs(node.expiresAt);
  const nowMs = now.getTime();
  if (expires !== null && expires <= nowMs) return "expired";
  if (observed !== null && observed > nowMs) return "future";
  if (observed === null && expires === null) return "undated";
  return "current";
}

export function buildNexoraTemporalWorldModel(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[] = [],
  now = new Date(),
): NexoraWorldModel & {
  temporal: {
    version: 1;
    asOf: string;
    nodes: TemporalNode[];
    relations: TemporalRelation[];
    currentNodeIds: string[];
    futureNodeIds: string[];
    expiredNodeIds: string[];
    undatedNodeIds: string[];
    timeOrderingAvailable: boolean;
    semantics: {
      temporalOnly: true;
      truthActivationAllowed: false;
      memoryMutationAllowed: false;
      toolExecutionAllowed: false;
      financialWriteAuthorization: false;
    };
    invariants: readonly string[];
  };
} {
  const world = buildNexoraWorldModel(nodes, edges);
  const bounded = nodes.slice(0, 200);
  const temporalNodes = bounded.map((node) => ({
    nodeId: node.id,
    observedAt: node.observedAt ?? null,
    expiresAt: node.expiresAt ?? null,
    status: statusFor(node, now),
  }));
  const byId = new Map(bounded.map((node) => [node.id, node]));
  const temporalRelations = edges.slice(0, 500).flatMap((edge) => {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) return [];
    const aObserved = dateMs(a.observedAt);
    const bObserved = dateMs(b.observedAt);
    const aExpires = dateMs(a.expiresAt);
    const bExpires = dateMs(b.expiresAt);
    const validFrom = [aObserved, bObserved].filter((x): x is number => x !== null).sort((x, y) => x - y)[0] ?? null;
    const expiryCandidates = [aExpires, bExpires].filter((x): x is number => x !== null).sort((x, y) => x - y);
    const validTo = expiryCandidates[0] ?? null;
    const temporalConfidence = clamp(((a.confidence + b.confidence) / 2) * (validFrom === null ? 0.8 : 1));
    return [{
      from: edge.from,
      to: edge.to,
      relation: edge.relation,
      validFrom: validFrom === null ? null : new Date(validFrom).toISOString(),
      validTo: validTo === null ? null : new Date(validTo).toISOString(),
      temporalConfidence,
    }];
  });

  const ids = (status: TemporalStatus) => temporalNodes.filter((n) => n.status === status).map((n) => n.nodeId);
  const timeOrderingAvailable = temporalNodes.some((n) => n.observedAt !== null || n.expiresAt !== null);

  return {
    ...world,
    temporal: {
      version: 1,
      asOf: now.toISOString(),
      nodes: temporalNodes,
      relations: temporalRelations,
      currentNodeIds: ids("current"),
      futureNodeIds: ids("future"),
      expiredNodeIds: ids("expired"),
      undatedNodeIds: ids("undated"),
      timeOrderingAvailable,
      semantics: {
        temporalOnly: true,
        truthActivationAllowed: false,
        memoryMutationAllowed: false,
        toolExecutionAllowed: false,
        financialWriteAuthorization: false,
      },
      invariants: [
        "temporal_status_is_as_of_timestamp",
        "expired_does_not_mean_false",
        "future_does_not_mean_true",
        "undated_is_not_current_by_default",
        "contradictions_are_not_silently_resolved",
        "temporal_model_does_not_authorize_actions",
        "temporal_model_does_not_mutate_memory",
      ],
    },
  };
}
