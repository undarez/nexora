import type { SupabaseClient } from '@supabase/supabase-js';

export type StrategyOutcome = 'success'|'partial'|'failed'|'blocked'|'human_required';
export type StrategyExperience = { strategyKey:string; outcome:StrategyOutcome; score:number; context?:Record<string, unknown>; evidence?:unknown[] };

export function rankStrategies(experiences: StrategyExperience[]) {
  const map = new Map<string,{total:number; count:number; successes:number}>();
  for (const e of experiences.slice(0,100)) {
    const x=map.get(e.strategyKey)||{total:0,count:0,successes:0};
    x.total+=e.score; x.count++; if(e.outcome==='success')x.successes++; map.set(e.strategyKey,x);
  }
  return [...map.entries()].map(([strategyKey,x])=>({strategyKey, averageScore:x.count?Math.round(x.total/x.count):0, sampleSize:x.count, successRate:x.count?x.successes/x.count:0}))
    .sort((a,b)=>b.averageScore-a.averageScore || b.successRate-a.successRate || b.sampleSize-a.sampleSize);
}

/** Selects only from an explicit allow-list. It never creates a new capability. */
export function chooseStrategy(experiences: StrategyExperience[], allowed: string[]) {
  const ranked=rankStrategies(experiences).filter(x=>allowed.includes(x.strategyKey));
  return ranked[0]?.strategyKey ?? allowed[0] ?? 'stop';
}

export async function loadStrategyExperiences(args:{supabase:SupabaseClient;userId:string;goalKey:string;limit?:number}):Promise<StrategyExperience[]> {
  const { data, error } = await args.supabase.from('lia_strategy_experiences')
    .select('strategy_key,outcome,score,context,evidence')
    .eq('user_id', args.userId).eq('goal_key', args.goalKey)
    .order('created_at', { ascending:false }).limit(Math.min(100, Math.max(1,args.limit ?? 100)));
  if(error) throw new Error(error.message);
  return (data ?? []).map((row:any)=>({ strategyKey:String(row.strategy_key), outcome:row.outcome as StrategyOutcome, score:Number(row.score), context:row.context && typeof row.context === 'object' && !Array.isArray(row.context) ? row.context : {}, evidence:Array.isArray(row.evidence)?row.evidence:[] }));
}

export async function persistStrategyExperience(args:{supabase:SupabaseClient;userId:string;goalKey:string;strategyKey:string;outcome:StrategyOutcome;score:number;context?:unknown;evidence?:unknown[]}) {
  const {data,error}=await args.supabase.rpc('lia_record_strategy_experience',{p_user_id:args.userId,p_goal_key:args.goalKey,p_strategy_key:args.strategyKey,p_outcome:args.outcome,p_score:args.score,p_context:args.context??{},p_evidence:args.evidence??[]});
  if(error) throw new Error(error.message); return data as string;
}

export function strategyScoreForOutcome(outcome: 'completed'|'continue'|'needs_human'|'blocked'|'failed') {
  if (outcome === 'completed') return { outcome:'success' as const, score:100 };
  if (outcome === 'continue') return { outcome:'partial' as const, score:25 };
  if (outcome === 'needs_human') return { outcome:'human_required' as const, score:0 };
  if (outcome === 'blocked') return { outcome:'blocked' as const, score:-70 };
  return { outcome:'failed' as const, score:-100 };
}
