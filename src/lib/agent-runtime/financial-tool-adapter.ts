import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLiaFinancialProjection } from "@/lib/lia/financial-data-gateway";

export type FinancialToolResult =
  | { handled: false }
  | { handled: true; result: unknown };

export async function executeFinancialAgentTool(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<FinancialToolResult> {
  switch (toolName) {
    case "get_financial_snapshot": {
      const projection = await buildLiaFinancialProjection({ supabase, userId, days: 90 });
      return {
        handled: true,
        result: {
          security_level: projection.security_level,
          account_count: projection.accounts.count,
          balance_total: projection.accounts.balance_total,
          transaction_count: projection.transactions.count,
          income: projection.transactions.income,
          expenses: projection.transactions.expenses,
          net: projection.transactions.net,
          categories: projection.transactions.categories,
          raw_data_exposed: false,
          vault_payload_exposed: false,
        },
      };
    }
    case "get_budget_status": {
      const { data, error } = await supabase
        .from("budgets")
        .select("id,period_start,period_end,target_end_balance,budget_lines(id,category_id,planned_amount,actual_amount)")
        .eq("user_id", userId)
        .order("period_start", { ascending: false })
        .limit(3);
      if (error) throw new Error(error.message);
      return { handled: true, result: { budgets: data ?? [], data_available: (data ?? []).length > 0 } };
    }
    case "get_cashflow": {
      const days = Math.min(Math.max(Number(args.days ?? 90), 1), 365);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await supabase
        .from("transactions")
        .select("amount,occurred_at")
        .eq("user_id", userId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: true })
        .limit(1000);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const income = rows.filter(r => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);
      const expenses = rows.filter(r => Number(r.amount) < 0).reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
      return {
        handled: true,
        result: {
          days,
          transaction_count: rows.length,
          income: Number(income.toFixed(2)),
          expenses: Number(expenses.toFixed(2)),
          net: Number((income - expenses).toFixed(2)),
          data_available: rows.length > 0,
        },
      };
    }
    case "get_wealth_snapshot": {
      const { data, error } = await supabase
        .from("wealth_entries")
        .select("*")
        .eq("user_id", userId)
        .order("valuation_date", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return { handled: true, result: { entry_count: rows.length, entries: rows, data_available: rows.length > 0 } };
    }
    case "get_forecast": {
      const { data, error } = await supabase
        .from("forecasts")
        .select("horizon,scenario,projected_balance,confidence,assumptions,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      return { handled: true, result: { forecast_count: data?.length ?? 0, forecasts: data ?? [], data_available: (data ?? []).length > 0 } };
    }
    case "search_transactions": {
      const query = typeof args.query === "string" ? args.query.trim().slice(0, 100) : "";
      const limit = Math.min(Math.max(Number(args.limit ?? 50), 1), 100);
      let request = supabase
        .from("transactions")
        .select("id,amount,occurred_at,label,source,category_id,categories(name)")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (query) request = request.ilike("label", `%${query}%`);
      const { data, error } = await request;
      if (error) throw new Error(error.message);
      return { handled: true, result: { query, count: data?.length ?? 0, transactions: data ?? [], data_available: (data ?? []).length > 0 } };
    }
    default:
      return { handled: false };
  }
}
