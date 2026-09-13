/** V5.08.37 — prospective outlook with explicit scenario bands. */
export type OutlookBand={name:string;assumption:string;monthlyNet:number;projectedBalance:number};
export function buildOutlookBands(args:{monthlyIncome:number;monthlyExpenses:number;currentBalance:number;horizonDays?:number}):OutlookBand[]{
 const h=Math.max(30,Math.min(180,args.horizonDays??90)), months=h/30, net=args.monthlyIncome-args.monthlyExpenses;
 return [
  {name:"Base",assumption:"Les flux moyens récents se poursuivent.",monthlyNet:net,projectedBalance:args.currentBalance+net*months},
  {name:"Revenus -10 %",assumption:"Les revenus mensuels diminuent de 10 %.",monthlyNet:args.monthlyIncome*.9-args.monthlyExpenses,projectedBalance:args.currentBalance+(args.monthlyIncome*.9-args.monthlyExpenses)*months},
  {name:"Dépenses +10 %",assumption:"Les dépenses mensuelles augmentent de 10 %.",monthlyNet:args.monthlyIncome-args.monthlyExpenses*1.1,projectedBalance:args.currentBalance+(args.monthlyIncome-args.monthlyExpenses*1.1)*months}
 ].map(x=>({...x,monthlyNet:Math.round(x.monthlyNet*100)/100,projectedBalance:Math.round(x.projectedBalance*100)/100}));
}