import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { buildLiaFinancialProjection } from "@/lib/lia/financial-data-gateway";
import type { AgentToolDefinition } from "./tool-definition";

export type FinancialToolResult =
  | { handled: false }
  | { handled: true; result: unknown };

const FINANCIAL_AGENT_TOOLS: AgentToolDefinition[] = [
  { name: "get_financial_snapshot", description: "Lire le snapshot financier de l'utilisateur authentifié.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "get_budget_status", description: "Calculer budget versus réel.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "get_cashflow", description: "Calculer les flux de trésorerie observés.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "get_wealth_snapshot", description: "Calculer le patrimoine à partir des entrées datées.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "get_forecast", description: "Lire les prévisions persistées et leurs scénarios.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "search_transactions", description: "Rechercher les transactions de l'utilisateur.", risk: "read", deterministic: true, requiresUserApproval: false },
  { name: "save_financial_insight", description: "Enregistrer une observation financière non transactionnelle et réversible.", risk: "recommendation", deterministic: true, requiresUserApproval: false },
];

export function getFinancialAgentTool(name: string) {
  return FINANCIAL_AGENT_TOOLS.find((tool) => tool.name === name);
}

/** Domain-owned tool selection for the financial chat route. */
export function toolsForFinancialTask(task: string) {
  switch (task) {
    case "budget": return ["get_budget_status", "get_cashflow"] as const;
    case "cashflow": return ["get_cashflow", "get_financial_snapshot"] as const;
    case "wealth": return ["get_wealth_snapshot", "get_financial_snapshot"] as const;
    default: return ["get_financial_snapshot", "get_budget_status", "get_cashflow", "get_wealth_snapshot", "get_forecast"] as const;
  }
}

export async function executeFinancialAgentTool(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
  context?: { admin: SupabaseClient; agentId: string; autonomyLevel: number },
): Promise<FinancialToolResult> {
  switch (toolName) {
    case "get_financial_snapshot": {
      const projection = await buildLiaFinancialProjection({ supabase, userId, days: 90 });
      return { handled: true, result: {
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
      }};
    }
    case "get_budget_status": {
      const { data, error } = await supabase.from("budgets").select("id,period_start,period_end,target_end_balance,budget_lines(id,category_id,planned_amount,actual_amount)").eq("user_id", userId).order("period_start", { ascending: false }).limit(3);
      if (error) throw new Error(error.message);
      return { handled: true, result: { budgets: data ?? [], data_available: (data ?? []).length > 0 } };
    }
    case "get_cashflow": {
      const days = Math.min(Math.max(Number(args.days ?? 90), 1), 365);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await supabase.from("transactions").select("amount,occurred_at").eq("user_id", userId).gte("occurred_at", since).order("occurred_at", { ascending: true }).limit(1000);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const income = rows.filter(r => Number(r.amount) > 0).reduce((s, r) => s + Number(r.amount), 0);
      const expenses = rows.filter(r => Number(r.amount) < 0).reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
      return { handled: true, result: { days, transaction_count: rows.length, income: Number(income.toFixed(2)), expenses: Number(expenses.toFixed(2)), net: Number((income - expenses).toFixed(2)), data_available: rows.length > 0 } };
    }
    case "get_wealth_snapshot": {
      const { data, error } = await supabase.from("wealth_entries").select("*").eq("user_id", userId).order("valuation_date", { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      return { handled: true, result: { entry_count: rows.length, entries: rows, data_available: rows.length > 0 } };
    }
    case "get_forecast": {
      const { data, error } = await supabase.from("forecasts").select("horizon,scenario,projected_balance,confidence,assumptions,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
      if (error) throw new Error(error.message);
      return { handled: true, result: { forecast_count: data?.length ?? 0, forecasts: data ?? [], data_available: (data ?? []).length > 0 } };
    }
    case "search_transactions": {
      const query = typeof args.query === "string" ? args.query.trim().slice(0, 100) : "";
      const limit = Math.min(Math.max(Number(args.limit ?? 50), 1), 100);
      let request = supabase.from("transactions").select("id,amount,occurred_at,label,source,category_id,categories(name)").eq("user_id", userId).order("occurred_at", { ascending: false }).limit(limit);
      if (query) request = request.ilike("label", "%" + query + "%");
      const { data, error } = await request;
      if (error) throw new Error(error.message);
      return { handled: true, result: { query, count: data?.length ?? 0, transactions: data ?? [], data_available: (data ?? []).length > 0 } };
    }
    case "save_financial_insight": {
      if (!context) throw new Error("Contexte d'exécution financière indisponible.");
      const title = typeof args.title === "string" ? args.title.slice(0, 200) : "Observation financière";
      const body = typeof args.body === "string" ? args.body.slice(0, 5000) : "";
      if (!body) throw new Error("Une observation financière doit contenir un contenu.");
      if (context.autonomyLevel < 3) throw new Error("Cette action nécessite L3.");
      const executionKey = createHash("sha256").update("insight:" + userId + ":" + context.agentId + ":" + title + ":" + body).digest("hex").slice(0, 48);
      const { data: existing } = await context.admin.from("lia_action_proposals").select("id,status").eq("user_id", userId).eq("execution_key", executionKey).maybeSingle();
      if (existing) return { handled: true, result: { status: "already_executed", execution_key: executionKey, proposal_id: existing.id } };
      const { data, error } = await context.admin.from("lia_action_proposals").insert({
        user_id: userId, agent_id: context.agentId, action_key: "save_financial_insight", title, description: body,
        risk_class: "recommendation", autonomy_level: context.autonomyLevel, reversible: true,
        payload: { title, body }, rollback_payload: { action: "delete_proposal", execution_key: executionKey },
        status: "executed", executed_at: new Date().toISOString(), execution_key: executionKey,
      }).select("id,title,description,status,execution_key,executed_at").single();
      if (error) throw new Error(error.message);
      await context.admin.from("lia_action_audit").insert({
        proposal_id: data.id, user_id: userId, agent_id: context.agentId, event: "insight_saved", actor: "lia_l3",
        metadata: { execution_key: executionKey, reversible: true, autonomy_level: context.autonomyLevel },
      });
      return { handled: true, result: { ...data, reversible: true, autonomous: true, autonomy_level: context.autonomyLevel } };
    }
    default:
      return { handled: false };
  }
}
