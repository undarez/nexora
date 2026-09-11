/** NEXORA Unified Application Context v1.
 * Single read-only bridge between application surfaces and LIA.
 * It composes the Personal Financial Model with safe notification state and
 * surface metadata. It never exposes notification bodies or raw financial IDs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLiaPersonalFinancialModel, compactLiaPersonalFinancialModel, type LiaPersonalFinancialModel } from "@/lib/lia/personal-financial-model";
import { LIA_DATA_GOVERNANCE } from "@/lib/lia/data-governance";

export type LiaApplicationSurface =
  | "dashboard" | "budget" | "transactions" | "goals" | "notifications"
  | "pilotage" | "previsions" | "patrimoine" | "banque" | "autopilot"
  | "habitudes" | "coffre" | "lia" | "other";

export type LiaSourceReliability = "authoritative" | "observed" | "signal" | "context";

export type LiaMultiSourceContext = {
  version: 1;
  sources: Array<{ source: string; reliability: LiaSourceReliability; available: boolean; read_only: true }>;
  finance: { available: boolean; source_of_truth: "supabase"; raw_ids_exposed: false };
  mail: { available: boolean; providers: string[]; metadata_only: true; bodies_included: false; attachments_included: false };
  rules: string[];
};

export type LiaApplicationContext = {
  version: 1;
  generated_at: string;
  surface: LiaApplicationSurface;
  personal_financial_model: ReturnType<typeof compactLiaPersonalFinancialModel>;
  multi_source: LiaMultiSourceContext;
  data_governance: typeof LIA_DATA_GOVERNANCE;
    notifications: {
    available: boolean;
    unread_count: number;
    severity_counts: Record<string, number>;
  };
  synchronization: {
    source_of_truth: "supabase";
    read_only_projection: true;
    raw_data_exposed: false;
    authority_granted: false;
  };
};

function normalizeSurface(value: unknown): LiaApplicationSurface {
  const allowed: LiaApplicationSurface[] = ["dashboard", "budget", "transactions", "goals", "notifications", "pilotage", "previsions", "patrimoine", "banque", "autopilot", "habitudes", "coffre", "lia", "other"];
  return typeof value === "string" && allowed.includes(value as LiaApplicationSurface) ? value as LiaApplicationSurface : "other";
}

export function buildLiaMultiSourceContext(args: {
  financeAvailable: boolean;
  mailProviders?: string[];
}): LiaMultiSourceContext {
  const providers = Array.from(new Set((args.mailProviders ?? []).filter(Boolean)));

  return {
    version: 1,
    sources: [
      { source: "financial_data", reliability: "authoritative", available: args.financeAvailable, read_only: true },
      { source: "mail_metadata", reliability: "signal", available: providers.length > 0, read_only: true },
      { source: "conversation", reliability: "context", available: true, read_only: true },
    ],
    finance: { available: args.financeAvailable, source_of_truth: "supabase", raw_ids_exposed: false },
    mail: { available: providers.length > 0, providers, metadata_only: true, bodies_included: false, attachments_included: false },
    rules: [
      "Une donnée financière confirmée prime sur un signal d'email.",
      "Un email peut signaler une facture ou une échéance, mais ne constitue pas à lui seul une preuve comptable.",
      "Une information absente d'une source disponible ne doit pas être inventée.",
      "Les projections et recommandations restent conditionnelles aux hypothèses explicites.",
      "Le contexte multi-source est en lecture seule et n'accorde aucune autorisation d'action.",
    ],
  };
}

export async function buildLiaApplicationContext(args: {
  supabase: SupabaseClient;
  userId: string;
  surface?: string | null;
  days?: number;
}): Promise<LiaApplicationContext> {
  const [model, notificationsResult, mailConnectionsResult] = await Promise.all([
    buildLiaPersonalFinancialModel({ supabase: args.supabase, userId: args.userId, days: args.days ?? 90 }),
    args.supabase.from("notifications").select("severity,read_at").eq("user_id", args.userId).limit(200),
    args.supabase.from("lia_mail_connections").select("provider,status").eq("user_id", args.userId),
  ]);

  if (notificationsResult.error && !/relation .*notifications.*does not exist/i.test(notificationsResult.error.message)) {
    throw new Error(`application_context_notifications:${notificationsResult.error.message}`);
  }

  const severityCounts: Record<string, number> = {};
  let unread = 0;
  for (const item of notificationsResult.data ?? []) {
    if (!item.read_at) unread += 1;
    const severity = String(item.severity ?? "info");
    severityCounts[severity] = (severityCounts[severity] ?? 0) + 1;
  }

  const mailProviders = (mailConnectionsResult.data ?? [])
    .filter((row: any) => row?.status === "connected" && typeof row?.provider === "string")
    .map((row: any) => String(row.provider));

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    surface: normalizeSurface(args.surface),
    personal_financial_model: compactLiaPersonalFinancialModel(model),
    data_governance: LIA_DATA_GOVERNANCE,
    multi_source: buildLiaMultiSourceContext({
      financeAvailable: model.financial.accounts.count > 0,
      mailProviders,
    }),
    notifications: {
      available: !notificationsResult.error,
      unread_count: unread,
      severity_counts: severityCounts,
    },
    synchronization: {
      source_of_truth: "supabase",
      read_only_projection: true,
      raw_data_exposed: false,
      authority_granted: false,
    },
  };
}
