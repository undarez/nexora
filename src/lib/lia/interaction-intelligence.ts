export const INTERACTION_EVENT_TYPES = [
  'page_focus','page_leave','view_entity','search','open_transaction','open_budget',
  'edit_budget','create_item','delete_item','change_forecast','view_indicator','submit_action',
  'repeat_view','hesitation',
] as const;
export type InteractionEventType = typeof INTERACTION_EVENT_TYPES[number];

export type InteractionEventInput = {
  eventType: InteractionEventType;
  path: string;
  sessionId: string;
  featureKey?: string;
  targetKey?: string;
  valueNumber?: number;
  metadata?: Record<string, string | number | boolean>;
};

const PATH_RE = /^\/[A-Za-z0-9_./#?=&-]{0,299}$/;
const SESSION_RE = /^[A-Za-z0-9_-]{16,80}$/;
const KEY_RE = /^[a-z0-9_.:-]{1,120}$/;
const META_KEYS = new Set(['source','navigation_source','visible_seconds','result_count','interaction_count']);

export function validateInteractionEvent(input: unknown): InteractionEventInput | null {
  if (!input || typeof input !== 'object') return null;
  const x = input as Record<string, unknown>;
  const eventType = typeof x.eventType === 'string' && INTERACTION_EVENT_TYPES.includes(x.eventType as InteractionEventType) ? x.eventType as InteractionEventType : null;
  const path = typeof x.path === 'string' ? x.path.split('?')[0].split('#')[0] : '';
  const sessionId = typeof x.sessionId === 'string' ? x.sessionId : '';
  if (!eventType || !PATH_RE.test(path) || !SESSION_RE.test(sessionId)) return null;
  const featureKey = x.featureKey == null ? undefined : typeof x.featureKey === 'string' && KEY_RE.test(x.featureKey) ? x.featureKey : null;
  const targetKey = x.targetKey == null ? undefined : typeof x.targetKey === 'string' && KEY_RE.test(x.targetKey) ? x.targetKey : null;
  if (featureKey === null || targetKey === null) return null;
  const valueNumber = x.valueNumber == null ? undefined : typeof x.valueNumber === 'number' && Number.isInteger(x.valueNumber) && Math.abs(x.valueNumber) <= 1000000 ? x.valueNumber : null;
  if (valueNumber === null) return null;
  const metadata: Record<string, string | number | boolean> = {};
  if (x.metadata && typeof x.metadata === 'object') {
    for (const [k,v] of Object.entries(x.metadata as Record<string, unknown>)) {
      if (!META_KEYS.has(k)) continue;
      if ((typeof v === 'string' && v.length <= 120) || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean') metadata[k] = v as string | number | boolean;
    }
  }
  return { eventType, path, sessionId, ...(featureKey ? {featureKey}:{}), ...(targetKey ? {targetKey}:{}), ...(valueNumber !== undefined ? {valueNumber}:{}), metadata };
}

export function interactionSummaryPrompt(events: Array<{event_type:string;path:string;target_key:string|null;occurred_at:string}>) {
  return events.slice(0,30).map(e => `${e.occurred_at}|${e.event_type}|${e.path}|${e.target_key ?? '-'}`).join('\n');
}
