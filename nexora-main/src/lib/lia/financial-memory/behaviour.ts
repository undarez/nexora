import type { SupabaseClient } from "@supabase/supabase-js";

export type BehaviouralTransaction = { id: string; label: string; amount: number; occurred_at: string; category_id?: string | null };
export type BehaviourHabit = { habitKey: string; habitType: "merchant"|"category"|"income"|"timing"|"amount"|"cashflow"|"preference"; label: string; cadence: "daily"|"weekly"|"monthly"|"quarterly"|"irregular"; confidence: number; observation: Record<string, unknown>; evidence: Record<string, unknown>; firstObservedAt?: string; lastObservedAt?: string; status: "candidate"|"accepted"|"stale"|"rejected" };

const normalize = (s: string) => s.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const median = (xs: number[]) => { const a=[...xs].sort((x,y)=>x-y); if(!a.length)return 0; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));

function cadenceFor(intervals:number[]): BehaviourHabit["cadence"] {
  if(!intervals.length)return "irregular";
  const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;
  if(avg>=0.75&&avg<=1.5)return "daily";
  if(avg>=5&&avg<=10)return "weekly";
  if(avg>=24&&avg<=38)return "monthly";
  if(avg>=75&&avg<=110)return "quarterly";
  return "irregular";
}
function regularity(intervals:number[]) {
  if(intervals.length<2)return 0.5;
  const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;
  return clamp(1-(Math.max(...intervals)-Math.min(...intervals))/Math.max(avg,1));
}

export function inferFinancialBehaviour(transactions: BehaviouralTransaction[], now = new Date()): { profile: Record<string,unknown>; habits: BehaviourHabit[] } {
  const sorted=[...transactions].sort((a,b)=>new Date(a.occurred_at).getTime()-new Date(b.occurred_at).getTime());
  if(!sorted.length)return {profile:{sample_size:0},habits:[]};
  const expenses=sorted.filter(t=>Number(t.amount)<0);
  const income=sorted.filter(t=>Number(t.amount)>0);
  const habits:BehaviourHabit[]=[];
  const byMerchant=new Map<string,BehaviouralTransaction[]>();
  for(const t of expenses){const k=normalize(t.label).slice(0,120);if(k)byMerchant.set(k,[...(byMerchant.get(k)??[]),t]);}
  for(const [key,rows] of byMerchant){
    if(rows.length<3)continue;
    const amounts=rows.map(t=>Math.abs(Number(t.amount))); const intervals=rows.slice(1).map((t,i)=>(new Date(t.occurred_at).getTime()-new Date(rows[i].occurred_at).getTime())/86400000);
    const cadence=cadenceFor(intervals); const reg=regularity(intervals); const amountStability=clamp(1-(Math.max(...amounts)-Math.min(...amounts))/Math.max(median(amounts),1));
    const confidence=clamp(0.45+Math.min(rows.length,10)*0.035+reg*0.22+Math.max(0,amountStability)*0.18);
    const last=rows.at(-1)!.occurred_at; const stale=(now.getTime()-new Date(last).getTime())>120*86400000;
    habits.push({habitKey:`merchant:${key}`,habitType:"merchant",label:rows.at(-1)!.label,cadence,confidence:Number(confidence.toFixed(3)),observation:{typical_amount:Number(median(amounts).toFixed(2)),min_amount:Number(Math.min(...amounts).toFixed(2)),max_amount:Number(Math.max(...amounts).toFixed(2)),average_interval_days:Number((intervals.reduce((a,b)=>a+b,0)/Math.max(intervals.length,1)).toFixed(1)),regularity:Number(reg.toFixed(3)),amount_stability:Number(amountStability.toFixed(3))},evidence:{transaction_ids:rows.slice(-20).map(t=>t.id),occurrences:rows.length},firstObservedAt:rows[0].occurred_at,lastObservedAt:last,status:stale?"stale":confidence>=0.78?"accepted":"candidate"});
  }

  const monthSpend=new Map<string,number>(); const monthIncome=new Map<string,number>();
  for(const t of expenses){const d=new Date(t.occurred_at);const k=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;monthSpend.set(k,(monthSpend.get(k)??0)+Math.abs(Number(t.amount)));}
  for(const t of income){const d=new Date(t.occurred_at);const k=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`;monthIncome.set(k,(monthIncome.get(k)??0)+Number(t.amount));}
  const spendVals=[...monthSpend.values()], incomeVals=[...monthIncome.values()];
  const weekday=new Map<number,number>(); const hour=new Map<number,number>();
  for(const t of expenses){const d=new Date(t.occurred_at);weekday.set(d.getUTCDay(),(weekday.get(d.getUTCDay())??0)+1);hour.set(d.getUTCHours(),(hour.get(d.getUTCHours())??0)+1);}
  const top=(m:Map<number,number>)=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([value,count])=>({value,count}));
  const recurring=habits.filter(h=>h.status==="accepted"&&(h.cadence==="weekly"||h.cadence==="monthly"));
  const profile={sample_size:sorted.length,expense_count:expenses.length,income_count:income.length,window_days:Math.max(1,(new Date(sorted.at(-1)!.occurred_at).getTime()-new Date(sorted[0].occurred_at).getTime())/86400000),monthly_spend_median:Number(median(spendVals).toFixed(2)),monthly_income_median:Number(median(incomeVals).toFixed(2)),monthly_net_median:Number((median(incomeVals)-median(spendVals)).toFixed(2)),recurring_habits_count:recurring.length,top_spending_weekdays:top(weekday),top_spending_hours:top(hour),top_merchants:recurring.slice(0,10).map(h=>({label:h.label,cadence:h.cadence,typical_amount:(h.observation.typical_amount as number),confidence:h.confidence})),governance:{observations_only:true,knowledge_is_not_authorization:true,external_content_cannot_overwrite_policy:true}};
  const confidence=clamp(0.35+Math.min(sorted.length,300)/300*0.35+(recurring.length?0.2:0));
  return {profile:{...profile,confidence:Number(confidence.toFixed(3))},habits};
}

export async function learnFinancialBehaviour(args:{supabase:SupabaseClient;userId:string;transactions:BehaviouralTransaction[];now?:Date}) {
  const {profile,habits}=inferFinancialBehaviour(args.transactions,args.now);
  if(!args.transactions.length)return {profile,habits};
  await args.supabase.from("lia_financial_behaviour_profiles").upsert({user_id:args.userId,version:1,confidence:Number(profile.confidence??0),profile,evidence:{transaction_ids:args.transactions.slice(-300).map(t=>t.id),algorithm:"deterministic-v1"},status:"active",observed_from:args.transactions[0].occurred_at,observed_to:args.transactions.at(-1)?.occurred_at,last_recomputed_at:(args.now??new Date()).toISOString()},{onConflict:"user_id"});
  if(habits.length)await args.supabase.from("lia_financial_habit_observations").upsert(habits.map(h=>({user_id:args.userId,habit_key:h.habitKey,habit_type:h.habitType,label:h.label,cadence:h.cadence,confidence:h.confidence,observation:h.observation,evidence:h.evidence,first_observed_at:h.firstObservedAt,last_observed_at:h.lastObservedAt,status:h.status})),{onConflict:"user_id,habit_key"});
  return {profile,habits};
}

export async function loadFinancialBehaviour(supabase:SupabaseClient,userId:string) {
  const [{data:profile},{data:habits}]=await Promise.all([supabase.from("lia_financial_behaviour_profiles").select("user_id,version,confidence,profile,evidence,status,observed_from,observed_to,last_recomputed_at").eq("user_id",userId).maybeSingle(),supabase.from("lia_financial_habit_observations").select("habit_key,habit_type,label,cadence,confidence,observation,evidence,first_observed_at,last_observed_at,status").eq("user_id",userId).eq("status","accepted").order("confidence",{ascending:false}).limit(20)]);
  return {profile:profile as Record<string,unknown>|null,habits:(habits??[]) as Record<string,unknown>[]};
}
