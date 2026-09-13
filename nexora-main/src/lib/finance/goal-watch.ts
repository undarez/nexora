export type FinancialGoal = { id:string; name:string; target_amount:number; current_amount:number; target_date:string|null; priority:number };
export type GoalSignal = { id:string; severity:"info"|"warning"|"danger"; title:string; message:string; actionHref:string; evidence:Record<string,number|string> };

/** Deterministic goal-trajectory checks. Read-only: no goal mutation and no LLM. */
export function detectGoalSignals(goals: FinancialGoal[], now = new Date()): GoalSignal[] {
  const signals: GoalSignal[] = [];
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (const g of goals) {
    const target = Number(g.target_amount), current = Number(g.current_amount);
    if (!g.id || !g.name || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current)) continue;
    const progress = Math.max(0, Math.min(1, current / target));
    if (progress >= 1) {
      signals.push({ id:`goal:${g.id}:complete`, severity:"info", title:`Objectif atteint · ${g.name}`, message:`L’objectif « ${g.name} » est actuellement atteint à ${Math.round(progress*100)} %.`, actionHref:"/pilotage", evidence:{goalId:g.id, progress:Math.round(progress*100)}});
      continue;
    }
    if (!g.target_date) continue;
    const deadline = new Date(`${g.target_date}T00:00:00Z`);
    if (Number.isNaN(deadline.getTime()) || deadline <= today) continue;
    const start = new Date(Date.UTC(today.getUTCFullYear()-1, today.getUTCMonth(), today.getUTCDate()));
    const totalDays = Math.max(1, Math.round((deadline.getTime()-start.getTime())/86400000));
    const remainingDays = Math.max(0, Math.round((deadline.getTime()-today.getTime())/86400000));
    const elapsedRatio = Math.max(0, Math.min(1, 1 - remainingDays/totalDays));
    const expected = Math.min(1, elapsedRatio);
    const gap = expected - progress;
    if (gap >= 0.25 || (remainingDays <= 60 && progress < 0.5)) {
      const remaining = Math.max(0, target-current);
      const severity = gap >= 0.5 ? "danger" : "warning";
      signals.push({ id:`goal:${g.id}:trajectory`, severity, title:`Objectif en retard · ${g.name}`, message:`La trajectoire de « ${g.name} » est en retard d’environ ${Math.round(gap*100)} points. Il reste ${remaining.toFixed(0)} € à atteindre avant le ${g.target_date}.`, actionHref:"/pilotage", evidence:{goalId:g.id,progress,expected,gap,remaining,remainingDays,target,current}});
    }
  }
  return signals.slice(0,8);
}
