export type RuleDecision = { allowed: boolean; reason: string; ruleIds: string[]; severity: 'info' | 'warning' | 'block' };
export const CORE_RULES = [
  { id: 'NO_NEGATIVE_CASHFLOW', label: 'Pas de trésorerie prévisionnelle négative' },
  { id: 'ESSENTIALS_FIRST', label: 'Charges essentielles prioritaires' },
  { id: 'LIQUID_RESERVE_FIRST', label: 'Réserve liquide avant investissement supplémentaire' },
  { id: 'TRACE_RULE_CHANGES', label: 'Toute évolution de règle est tracée et réversible' },
  { id: 'LEARNING_REQUIRES_EVIDENCE', label: 'Une correction doit être fondée sur un écart observé' },
  { id: 'WEB_RESEARCH_NEVER_OVERRIDES', label: 'La veille externe ne modifie jamais seule une règle critique' },
];
export function supervise(input: { projectedCashflow: number; essentialsCovered: boolean; proposedInvestment: number; liquidReserve: number; targetReserve: number }): RuleDecision {
  if (input.projectedCashflow < 0) return { allowed: false, severity: 'block', reason: 'Action bloquée : la trésorerie prévisionnelle devient négative.', ruleIds: ['NO_NEGATIVE_CASHFLOW'] };
  if (!input.essentialsCovered) return { allowed: false, severity: 'block', reason: 'Action bloquée : les charges essentielles ne sont pas sécurisées.', ruleIds: ['ESSENTIALS_FIRST'] };
  if (input.proposedInvestment > 0 && input.liquidReserve < input.targetReserve) return { allowed: false, severity: 'warning', reason: 'Investissement additionnel reporté : la réserve liquide est sous le seuil.', ruleIds: ['LIQUID_RESERVE_FIRST'] };
  return { allowed: true, severity: 'info', reason: 'Action compatible avec les règles actuelles.', ruleIds: ['NO_NEGATIVE_CASHFLOW', 'ESSENTIALS_FIRST'] };
}
