import { emailLayout, escapeHtml } from "@/lib/email/brand";
import { sendNexoraEmail } from "@/lib/email/resend";

type Db = { from: (table: string) => any; auth?: { admin?: { getUserById: (id: string) => Promise<any> } } };
const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export async function sendWeeklyFinancialReport({ supabase, userId, admin }: { supabase: Db; userId: string; admin: Db }) {
  const userResult = await admin.auth?.admin?.getUserById(userId);
  const email = userResult?.data?.user?.email as string | undefined;
  if (!email) throw new Error("weekly_report_recipient_missing");

  const now = new Date();
  const start = new Date(now.getTime() - 7 * 86400000);
  const previousStart = new Date(now.getTime() - 14 * 86400000);
  const [tx, bankTx, oldTx, oldBankTx, accounts, bankAccounts, scenario] = await Promise.all([
    supabase.from("transactions").select("amount,occurred_at").eq("user_id", userId).gte("occurred_at", start.toISOString()).lt("occurred_at", now.toISOString()),
    supabase.from("bank_transactions").select("amount,booked_at").eq("user_id", userId).gte("booked_at", start.toISOString()).lt("booked_at", now.toISOString()),
    supabase.from("transactions").select("amount,occurred_at").eq("user_id", userId).gte("occurred_at", previousStart.toISOString()).lt("occurred_at", start.toISOString()),
    supabase.from("bank_transactions").select("amount,booked_at").eq("user_id", userId).gte("booked_at", previousStart.toISOString()).lt("booked_at", start.toISOString()),
    supabase.from("accounts").select("balance").eq("user_id", userId),
    supabase.from("bank_accounts").select("balance,status").eq("user_id", userId).eq("status", "active"),
    supabase.from("budget_scenarios").select("envelopes").eq("user_id", userId).order("period_start", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [tx, bankTx, oldTx, oldBankTx, accounts, bankAccounts, scenario]) if (result.error) throw new Error("weekly_report_data_unavailable");

  const values = (rows: Array<{amount:number|string}> | null) => (rows ?? []).map(row => Number(row.amount) || 0);
  const current = [...values(tx.data), ...values(bankTx.data)];
  const previous = [...values(oldTx.data), ...values(oldBankTx.data)];
  const expenses = current.filter(n => n < 0).reduce((s,n) => s + Math.abs(n), 0);
  const income = current.filter(n => n > 0).reduce((s,n) => s + n, 0);
  const priorExpenses = previous.filter(n => n < 0).reduce((s,n) => s + Math.abs(n), 0);
  const balance = (accounts.data ?? []).reduce((s:number,r:{balance:number|string}) => s + (Number(r.balance)||0),0)
    + (bankAccounts.data ?? []).reduce((s:number,r:{balance:number|string}) => s + (Number(r.balance)||0),0);
  const envelopes = Array.isArray(scenario.data?.envelopes) ? scenario.data.envelopes as Array<{planned?:number;spent?:number}> : [];
  const planned = envelopes.reduce((s,r) => s + Math.max(0,Number(r.planned)||0),0);
  const budgetSpent = envelopes.reduce((s,r) => s + Math.max(0,Number(r.spent)||0),0);

  const criteria = [
    { name: "Budget", max: 25, points: planned ? (budgetSpent/planned <= .8 ? 25 : budgetSpent/planned <= 1 ? 18 : budgetSpent/planned <= 1.15 ? 10 : 0) : 12,
      detail: planned ? `${eur(budgetSpent)} consommés sur ${eur(planned)} prévus.` : "Budget absent : critère partiellement évalué." },
    { name: "Équilibre des flux", max: 25, points: income ? (income >= expenses ? 25 : expenses-income <= income*.2 ? 15 : expenses-income <= income*.5 ? 8 : 0) : 12,
      detail: `Entrées ${eur(income)}, dépenses ${eur(expenses)}, net ${eur(income-expenses)}.` },
    { name: "Réserve", max: 20, points: expenses ? (balance/expenses >= 4 ? 20 : balance/expenses >= 2 ? 15 : balance/expenses >= 1 ? 10 : balance > 0 ? 5 : 0) : (balance > 0 ? 10 : 0),
      detail: `Solde estimé ${eur(balance)} ; dépenses de la semaine ${eur(expenses)}.` },
    { name: "Évolution des dépenses", max: 15, points: priorExpenses ? (expenses <= priorExpenses ? 15 : expenses <= priorExpenses*1.1 ? 10 : expenses <= priorExpenses*1.25 ? 5 : 0) : 8,
      detail: `${eur(expenses)} cette semaine contre ${eur(priorExpenses)} la semaine précédente.` },
    { name: "Qualité des données", max: 15, points: current.length > 0 && (accounts.data?.length || bankAccounts.data?.length) ? 15 : 5,
      detail: "Le score dépend des opérations et comptes accessibles au moment du calcul." },
  ];
  const score = criteria.reduce((s,c) => s+c.points,0);
  const label = score >= 85 ? "Très bonne maîtrise" : score >= 70 ? "Situation plutôt saine" : score >= 50 ? "Vigilance recommandée" : score >= 30 ? "Actions prioritaires" : "Situation à examiner";
  const list = criteria.map(c => `<li style="margin:0 0 12px"><strong>${escapeHtml(c.name)} — ${c.points}/${c.max}</strong><br><span>${escapeHtml(c.detail)}</span></li>`).join("");
  const html = emailLayout("Bilan financier hebdomadaire", `Score ${score}/100 — dépenses ${eur(expenses)}`,
    `<p>Voici votre bilan des 7 derniers jours.</p><div style="padding:18px;background:#f3f4f6;border-radius:12px"><div style="font-size:34px;font-weight:800">${score}/100</div><strong>${label}</strong></div><p>Dépenses : <strong>${eur(expenses)}</strong><br>Dépenses semaine précédente : <strong>${eur(priorExpenses)}</strong><br>Entrées détectées : <strong>${eur(income)}</strong><br>Solde disponible estimé : <strong>${eur(balance)}</strong></p><p style="font-size:13px;color:#6b7280">Le solde est le dernier total connu des comptes manuels et bancaires actifs. Il n'est pas garanti en temps réel : vérifiez la dernière synchronisation bancaire.</p><h2>Détail du score et conditions</h2><ul>${list}</ul><p>Indicateur de pilotage informatif, pas un diagnostic ni un conseil d'investissement.</p>`,
    { label: "Ouvrir mon tableau de bord", href: `${process.env.NEXT_PUBLIC_APP_URL || "https://nexora.finance"}/dashboard` });
  const sent = await sendNexoraEmail({to:email,subject:`NEXORA · Bilan hebdomadaire ${score}/100`,html,text:`Bilan NEXORA\nDépenses: ${eur(expenses)}\nSemaine précédente: ${eur(priorExpenses)}\nEntrées: ${eur(income)}\nSolde estimé: ${eur(balance)}\nScore: ${score}/100 — ${label}\n\n${criteria.map(c=>`${c.name}: ${c.points}/${c.max} — ${c.detail}`).join("\n")}\n\nLe solde n'est pas garanti en temps réel.`});
  if (!sent.ok) throw new Error(sent.error);
  return { status: "sent", score, emailId: sent.id ?? null };
}
