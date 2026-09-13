import { redirect } from "next/navigation";
import { BrainCircuit, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth/admin";
import LearningReviewClient from "./ui";

export default async function AdminLiaLearningPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/");
  const { user, isAdmin } = await getAdminContext(supabase);
  if (!user || !isAdmin) redirect("/");
  return <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
    <div><p className="text-sm font-semibold text-primary">Administration · LIA</p><h1 className="text-3xl font-bold flex items-center gap-2"><BrainCircuit className="h-7 w-7"/> Learning Review Board</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">File de revue des améliorations candidates issues du feedback, de l’évaluation et du replay. Une décision humaine ne déclenche aucune activation automatique.</p></div>
    <Card><CardContent className="p-5 flex gap-3 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-primary"/><div><b>Garde-fou de promotion</b><p className="mt-1 text-muted-foreground">Approuver signifie « validé pour l’étape suivante de gouvernance », pas « actif ». Les poids du modèle, politiques, permissions et faits financiers restent inchangés.</p></div></CardContent></Card>
    <LearningReviewClient />
  </main>;
}
