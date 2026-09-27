import type { createClient } from "@/lib/supabase/server";
import { learnFinancialHabits } from "@/lib/lia/financial-memory/pipeline";
import { buildLiaFinancialProjection } from "@/lib/lia/financial-data-gateway";
import { buildLiaPersonalFinancialModel, compactLiaPersonalFinancialModel } from "@/lib/lia/personal-financial-model";
import { buildMultiSourceContext } from "@/lib/lia/multi-source-context";

const MAX_TRANSACTIONS = 100;

export async function loadLiaFinancialContext({
  supabase,
  userId,
  since,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  since: Date;
}) {
  if (!supabase) throw new Error("Supabase n'est pas configuré.");

  const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const nextMonthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-01`;
  
    const [accountsResult, transactionsResult, budgetsResult, goalsResult, forecastsResult, learningResult, loopsResult, fixedExpensesResult, scenarioResult] = await Promise.all([
      supabase.from("accounts").select("id,name,kind,balance,currency").eq("user_id", user.id),
      supabase.from("transactions").select("id,amount,occurred_at,label,source,category_id,categories(name)").eq("user_id", user.id).gte("occurred_at", since.toISOString()).order("occurred_at", { ascending: false }).limit(MAX_TRANSACTIONS),
      supabase.from("budgets").select("id,period_start,period_end,target_end_balance,budget_lines(id,category_id,planned_amount,actual_amount)").eq("user_id", user.id).order("period_start", { ascending: false }).limit(3),
      supabase.from("goals").select("name,target_amount,current_amount,target_date,priority").eq("user_id", user.id).order("priority", { ascending: true }),
      supabase.from("forecasts").select("horizon,scenario,projected_balance,confidence,assumptions,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(9),
      supabase.from("learning_events").select("event_type,before_value,after_value,evidence,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("loop_runs").select("loop_type,period_start,period_end,status,context,findings,recommendations,summary,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
      supabase.from("fixed_expenses").select("id,label,sector,icon,amount,due_day,recurrence,effective_from,effective_until,is_active,notes").eq("user_id", user.id).eq("is_active", true).order("due_day"),
      supabase.from("budget_scenarios").select("id,period_start,name,income,starting_balance,safety_reserve,extra_expense,weeks_remaining,envelopes").eq("user_id", user.id).eq("period_start", monthKey).maybeSingle(),
    ]);
  
    const results = [accountsResult, transactionsResult, budgetsResult, goalsResult, forecastsResult, learningResult, loopsResult, fixedExpensesResult, scenarioResult];
    const firstError = results.find((result) => result.error);
    if (firstError?.error) {
      return NextResponse.json({ error: `Impossible de charger les données financières : ${firstError.error.message}` }, { status: 500 });
    }
  
    const accounts = accountsResult.data ?? [];
    const transactions = transactionsResult.data ?? [];
    try {
      await learnFinancialHabits({
        supabase,
        userId: user.id,
        transactions: transactions.map((t: any) => ({ id: String(t.id), label: String(t.label ?? ""), amount: Number(t.amount ?? 0), occurred_at: String(t.occurred_at) })),
      });
    } catch (error) {
      console.warn("Apprentissage des habitudes financières indisponible:", error instanceof Error ? error.message : error);
    }
    let mailConnections: unknown[] = [];
    try {
      const { data: mailRows } = await supabase.from("lia_mail_connections").select("provider,email,status,last_sync_at").eq("user_id", user.id);
      mailConnections = (mailRows ?? []).map((m: any) => ({ provider: m.provider, email: m.email ?? null, status: m.status, last_sync_at: m.last_sync_at ?? null }));
    } catch { /* optional integration: financial reasoning must continue without mail */ }
  
    const multiSourceContext = buildMultiSourceContext({
      financeAvailable: accounts.length > 0 || transactions.length > 0,
      financeSummary: { balance: Number(accounts.reduce((sum, account) => sum + Number(account.balance ?? 0), 0).toFixed(2)) },
      mailConnections: mailConnections as Array<{ provider?: string; status?: string }>,
    });
  
    const balance = accounts.reduce((sum, account) => sum + Number(account.balance ?? 0), 0);
    const income90d = transactions.filter((t) => Number(t.amount) > 0).reduce((sum, t) => sum + Number(t.amount), 0);
    const expense90d = transactions.filter((t) => Number(t.amount) < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  
    // Do not send the Supabase auth UUID to the model: it is not needed for reasoning.
    let financialProjection: Awaited<ReturnType<typeof buildLiaFinancialProjection>> | null = null;
    try {
      financialProjection = await buildLiaFinancialProjection({ supabase, userId: user.id, days: 90 });
    } catch (error) {
      console.warn("Passerelle de données financières sécurisée indisponible; contexte LIA réduit:", error instanceof Error ? error.message : error);
    }
  
    let personalFinancialModel: Awaited<ReturnType<typeof buildLiaPersonalFinancialModel>> | null = null;
    try {
      personalFinancialModel = await buildLiaPersonalFinancialModel({ supabase, userId: user.id, days: 90 });
    } catch (error) {
      console.warn("Modèle financier personnel indisponible; contexte conservateur:", error instanceof Error ? error.message : error);
    }
  
    const context = compact({
      period: { from: since.toISOString(), to: new Date().toISOString() },
      summary: { account_balance_total: Number(balance.toFixed(2)), income_90d: Number(income90d.toFixed(2)), expenses_90d: Number(expense90d.toFixed(2)), transaction_count: transactions.length },
      financial_data_gateway: financialProjection,
      personal_financial_model: personalFinancialModel ? compactLiaPersonalFinancialModel(personalFinancialModel) : null,
      accounts: { count: accounts.length },
      transactions: { count: transactions.length },
      budgets: budgetsResult.data ?? [],
      goals: goalsResult.data ?? [],
      forecasts: forecastsResult.data ?? [],
      recent_learning_events: learningResult.data ?? [],
      recent_loop_analyses: loopsResult.data ?? [],
      relational: relationalProfile ?? null,
      relational_profile: relationalContext?.profile ?? null,
      multi_source: multiSourceContext,
      mail_integrations: { connections: mailConnections, policy: "metadata-first; email bodies and attachments are not included in financial reasoning by default" },
      budget_planning: {
        month: monthKey,
        scenario: scenarioResult.data ?? null,
        fixed_expenses: (fixedExpensesResult.data ?? []).filter((expense: any) => {
          const ym = monthKey.slice(0, 7);
          if (expense.recurrence === "one_off") return String(expense.effective_from).slice(0, 7) === ym;
          return String(expense.effective_from).slice(0, 7) <= ym && (!expense.effective_until || String(expense.effective_until).slice(0, 7) >= ym);
        }),
        note: "Ces charges fixes et hypothèses de scénario sont des engagements de planification. Elles doivent être prises en compte avec les transactions observées, sans les confondre.",
      },
    });
  return {
    monthKey,
    accounts,
    transactions,
    budgetsResult,
    goalsResult,
    forecastsResult,
    learningResult,
    loopsResult,
    fixedExpensesResult,
    scenarioResult,
    mailConnections,
    multiSourceContext,
    balance,
    income90d,
    expense90d,
    financialProjection,
    personalFinancialModel,
    context,
    errorMessage: firstError?.error?.message ?? null,
  };
}
