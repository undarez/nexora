export type AutonomyLevel = 0|1|2|3|4|5|6|7|8;
export const AUTONOMY_LABELS: Record<AutonomyLevel,string> = {
  0: 'Répondre', 1: 'Proposer', 2: 'Préparer', 3: 'Exécuter à faible risque',
  4: 'Enchaîner des actions à faible risque', 5: 'Objectif complexe supervisé',
  6: 'Changer de stratégie', 7: 'Apprendre d’expériences validées', 8: 'Objectifs complexes étendus',
};
export function clampAutonomy(value: unknown, fallback: AutonomyLevel = 1): AutonomyLevel {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(0, Math.min(8, n)) as AutonomyLevel;
}
export function requiresHumanApproval(level: AutonomyLevel, risk: string) {
  return level >= 2 || ['write','write-sensitive','delete','execute','external','irreversible','critical'].includes(risk);
}
