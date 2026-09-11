import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function MetricCard({title,value,description,tone="neutral"}:{title:string;value:string;description:string;tone?:"positive"|"warning"|"danger"|"neutral"}){
 const c={positive:"text-[var(--success)]",warning:"text-amber-600",danger:"text-red-600",neutral:"text-slate-900"}[tone];
 return <Card><CardHeader><CardTitle className="text-sm text-slate-500">{title}</CardTitle></CardHeader><CardContent><div className={`financial-number text-3xl font-bold ${c}`}>{value}</div><p className="mt-1 text-xs text-slate-500">{description}</p></CardContent></Card>
}
