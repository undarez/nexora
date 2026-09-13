import type { SupabaseClient } from "@supabase/supabase-js";
import { buildUnifiedFinancialContext, type UnifiedFinancialContext } from "@/lib/finance/unified-financial-context";

export type EnterpriseDashboardContext = {
  generated_at: string;
  company: {
    name: string;
    legal_name: string | null;
    trade_name: string | null;
    siret: string | null;
    siren: string | null;
    legal_form: string | null;
    activity_label: string | null;
    city: string | null;
    verified: boolean;
  };
  financial: UnifiedFinancialContext;
  history: Array<{ month: string; label: string; income: number; expenses: number; net: number }>;
  top_expenses: Array<{ category: string; amount: number; count: number }>;
  fixed_commitments: number;
  data_quality: {
    transaction_count: number;
    connected_accounts: number;
    budget_available: boolean;
    accounting_available: false;
    invoices_available: false;
  };
};

const round = (n: number) => Number(n.toFixed(2));
const monthStart = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
const monthLabel = (month: string) => new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(new Date(`${month}T12:00:00`));

export async function buildEnterpriseDashboardContext({ supabase, userId, periodStart }: { supabase: SupabaseClient; userId: string; periodStart?: string }): Promise<EnterpriseDashboardContext> {
  const financial = await buildUnifiedFinancialContext({ supabase, userId, periodStart });
  const selectedMonth = financial.period_start;
  const sixMonthsAgo = new Date(`${selectedMonth}T12:00:00`);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const historyStart = monthStart(sixMonthsAgo);
  const historyEndDate = new Date(`${selectedMonth}T12:00:00`);
  historyEndDate.setMonth(historyEndDate.getMonth() + 1);
  const historyEnd = monthStart(historyEndDate);

  const [bankTxResult, manualTxResult, profileResult, membershipResult] = await Promise.all([
    supabase.from("bank_transactions").select("id,amount,booked_at").eq("user_id", userId).gte("booked_at", historyStart).lt("booked_at", historyEnd).order("booked_at", { ascending: true }).limit(5000),
    supabase.from("transactions").select("id,amount,occurred_at").eq("user_id", userId).gte("occurred_at", `${historyStart}T00:00:00Z`).lt("occurred_at", `${historyEnd}T00:00:00Z`).order("occurred_at", { ascending: true }).limit(5000),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("financial_workspace_members").select("workspace_id,financial_workspaces!inner(name,workspace_type,status)").eq("user_id", userId).eq("status", "active").eq("financial_workspaces.workspace_type", "business").eq("financial_workspaces.status", "active").limit(1).maybeSingle(),
  ]);

  const bankTx = bankTxResult.error ? [] : (bankTxResult.data ?? []);
  const manualTx = manualTxResult.error ? [] : (manualTxResult.data ?? []);
  const buckets = new Map<string, { income: number; expenses: number }>();
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(`${selectedMonth}T12:00:00`);
    d.setMonth(d.getMonth() - (5 - i));
    buckets.set(monthStart(d), { income: 0, expenses: 0 });
  }
  for (const tx of bankTx) {
    const key = String(tx.booked_at).slice(0, 7) + "-01";
    const bucket = buckets.get(key); if (!bucket) continue;
    const amount = Number(tx.amount || 0);
    if (amount >= 0) bucket.income += amount; else bucket.expenses += Math.abs(amount);
  }
  for (const tx of manualTx) {
    const key = String(tx.occurred_at).slice(0, 7) + "-01";
    const bucket = buckets.get(key); if (!bucket) continue;
    const amount = Number(tx.amount || 0);
    if (amount >= 0) bucket.income += amount; else bucket.expenses += Math.abs(amount);
  }
  const history = [...buckets.entries()].map(([month, value]) => ({ month, label: monthLabel(month), income: round(value.income), expenses: round(value.expenses), net: round(value.income - value.expenses) }));

  let company = {
    name: String((membershipResult.data as any)?.financial_workspaces?.name || profileResult.data?.display_name || "Mon entreprise"),
    legal_name: null as string | null, trade_name: null as string | null, siret: null as string | null, siren: null as string | null,
    legal_form: null as string | null, activity_label: null as string | null, city: null as string | null, verified: false,
  };
  const workspaceId = (membershipResult.data as any)?.workspace_id as string | undefined;
  if (workspaceId) {
    const business = await supabase.from("business_profiles").select("legal_name,trade_name,siret,siren,legal_form,activity_label,city,verification_status").eq("workspace_id", workspaceId).maybeSingle();
    if (!business.error && business.data) {
      company = { ...company, name: String(business.data.trade_name || business.data.legal_name || company.name), legal_name: business.data.legal_name, trade_name: business.data.trade_name, siret: business.data.siret, siren: business.data.siren, legal_form: business.data.legal_form, activity_label: business.data.activity_label, city: business.data.city, verified: business.data.verification_status === "verified" };
    }
  }

  return {
    generated_at: new Date().toISOString(),
    company,
    financial,
    history,
    top_expenses: financial.categories.slice(0, 8),
    fixed_commitments: financial.budget.fixed_commitments,
    data_quality: {
      transaction_count: financial.cashflow.transaction_count,
      connected_accounts: financial.liquidity.connected_accounts,
      budget_available: financial.budget.available,
      accounting_available: false,
      invoices_available: false,
    },
  };
}
