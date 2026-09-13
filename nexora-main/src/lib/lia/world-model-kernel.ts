/**
 * NEXORA World Model Kernel v1
 *
 * Builds a bounded conceptual model from knowledge-graph proposals.
 * It is descriptive only: no truth activation, memory mutation, tool execution,
 * or financial authority is granted by this kernel.
 */
import type { KnowledgeNode, KnowledgeEdge } from "./knowledge-graph";

export type WorldEntity = { id: string; label: string; nodeIds: string[] };
export type WorldRelation = { from: string; to: string; relation: KnowledgeEdge["relation"] | "related_to"; confidence: number };

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const key = (s: string) => normalize(s).split(/\s+/).filter(Boolean).slice(0, 6).join("-") || "unknown";

export function buildNexoraWorldModel(nodes: KnowledgeNode[], edges: KnowledgeEdge[] = []) {
  const bounded = nodes.slice(0, 200);
  const byTopic = new Map<string, string[]>();
  for (const node of bounded) {
    const topic = normalize(node.topic) || "unknown";
    byTopic.set(topic, [...(byTopic.get(topic) ?? []), node.id]);
  }

  const entities: WorldEntity[] = [...byTopic.entries()].map(([topic, nodeIds]) => ({
    id: `entity:${key(topic)}`, label: topic, nodeIds,
  }));
  const entityByNode = new Map<string, string>();
  for (const entity of entities) for (const nodeId of entity.nodeIds) entityByNode.set(nodeId, entity.id);

  const relations: WorldRelation[] = [];
  for (const edge of edges.slice(0, 500)) {
    const from = entityByNode.get(edge.from); const to = entityByNode.get(edge.to);
    if (!from || !to || from === to) continue;
    const a = bounded.find(n => n.id === edge.from); const b = bounded.find(n => n.id === edge.to);
    relations.push({ from, to, relation: edge.relation, confidence: clamp(((a?.confidence ?? 50) + (b?.confidence ?? 50)) / 2) });
  }

  return {
    version: 1,
    entities,
    relations,
    nodeCount: bounded.length,
    relationCount: relations.length,
    unresolvedNodeIds: bounded.filter(n => !entityByNode.has(n.id)).map(n => n.id),
    semantics: {
      descriptiveOnly: true,
      truthActivationAllowed: false,
      memoryMutationAllowed: false,
      toolExecutionAllowed: false,
      financialWriteAuthorization: false,
    },
    invariants: [
      "world_model_is_not_truth",
      "provenance_stays_on_source_nodes",
      "contradictions_are_not_silently_resolved",
      "world_model_does_not_authorize_actions",
      "world_model_does_not_mutate_memory",
    ],
  } as const;
}

export type NexoraWorldModel = ReturnType<typeof buildNexoraWorldModel>;
