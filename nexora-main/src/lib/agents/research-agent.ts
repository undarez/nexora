export type KnowledgeItem = { title: string; source: string; publishedAt?: string; kind: 'fact' | 'method' | 'opinion'; confidence: number; tags: string[] };
export function rankKnowledge(items: KnowledgeItem[]) { return [...items].sort((a,b) => b.confidence - a.confidence); }
export function shouldReview(item: KnowledgeItem, now = new Date()) {
  if (!item.publishedAt) return false;
  const age = now.getTime() - new Date(item.publishedAt).getTime();
  return age > 180 * 24 * 60 * 60 * 1000;
}
