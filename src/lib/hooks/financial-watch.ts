export type WatchEvent = 'transaction.created' | 'balance.changed' | 'schedule.daily' | 'schedule.weekly' | 'knowledge.updated';
export type WatchResult = { event: WatchEvent; actions: string[] };
export function financialWatch(event: WatchEvent): WatchResult {
  const actions: string[] = [];
  if (event === 'transaction.created' || event === 'balance.changed') actions.push('Recatégoriser si nécessaire', 'Recalculer budget', 'Recalculer prévisions', 'Évaluer risque de découvert');
  if (event === 'schedule.daily') actions.push('Vérifier nouvelles opérations', 'Mettre à jour perspectives');
  if (event === 'schedule.weekly') actions.push('Comparer prévu/réel', 'Ajuster enveloppes proposées');
  if (event === 'knowledge.updated') actions.push('Évaluer la source', 'Soumettre toute évolution au superviseur');
  return { event, actions };
}
