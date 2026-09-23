import { createClient } from "@supabase/supabase-js";
import { registerExecutableLiaSkill, type LiaSkillExecutionContext } from "../agent/skill-runtime.ts";
import type { LiaPermission } from "../skills/types.ts";
import { calculateFinanceAnalytics } from "../skills/finance-analytics.ts";
import { runFinancialReasoning } from "../financial-reasoning.ts";
import { createGoalLifecycle, advanceGoalLifecycle } from "../goal-lifecycle.ts";
import { buildLiaFinancialProjection } from "../financial-data-gateway.ts";
import { discoverTrustedSources } from "../research/search/index.ts";
import { getResearchDomainPolicy } from "../research/trust/registry.ts";

type AnyRecord = Record<string, unknown>;
const objectInput = (input: unknown): AnyRecord => {
  if (input && typeof input === "object" && !Array.isArray(input)) return input as AnyRecord;
  const text = String(input ?? "").trim();
  if (!text) return {};
  try { const parsed = JSON.parse(text); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as AnyRecord : { text }; }
  catch { return { text }; }
};
const rowsInput = (input: unknown): AnyRecord[] => {
  const value = objectInput(input);
  const rows = Array.isArray(value.rows) ? value.rows : Array.isArray(input) ? input : [];
  return rows.filter(row => row && typeof row === "object") as AnyRecord[];
};
const number = (value: unknown, fallback = 0) => { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : fallback; };
const round = (value: number) => Math.round(value * 100) / 100;
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }) : null;
}
function register(id: string, name: string, description: string, permissions: readonly LiaPermission[], execute: (input: unknown, context: LiaSkillExecutionContext) => Promise<unknown>, verify: (output: unknown) => Promise<{ ok: boolean; reason?: string }>) {
  registerExecutableLiaSkill({ id, name, description, capabilities: ["specialist-adapter"], requiredPermissions: permissions, riskClass: "read", execute, verify });
}
let registered = false;
export function registerChapter7SpecialistAdapters(): void {
  if (registered) return;
  registered = true;

  register("finance-analytics", "Finance Analytics", "Projection financière sécurisée depuis les données autorisées.", ["finance.read"],
    async (input, context) => {
      const value = objectInput(input), client = adminClient();
      if (client) return { source: "financial-data-gateway", projection: await buildLiaFinancialProjection({ supabase: client, userId: context.userId, days: number(value.days, 90) }) };
      const transactions = Array.isArray(value.transactions) ? value.transactions : [];
      return { source: "input", analytics: calculateFinanceAnalytics({ transactions: transactions as never[] }) };
    },
    async output => ({ ok: Boolean(output && typeof output === "object"), reason: "La projection financière doit rester structurée." }));

  register("financial-reasoning", "Financial Reasoning", "Analyse déterministe des variations, récurrences et anomalies financières.", ["finance.read"],
    async (input, context) => {
      const value = objectInput(input);
      let transactions = Array.isArray(value.transactions) ? value.transactions : [];
      if (!transactions.length) {
        const client = adminClient();
        if (client) {
          const { data, error } = await client.from("bank_transactions").select("amount,booked_at,category").eq("user_id", context.userId).order("booked_at", { ascending: false }).limit(2000);
          if (error) throw new Error("financial_reasoning_data:" + error.message);
          transactions = (data ?? []).map(row => ({ amount: row.amount, occurred_at: row.booked_at, label: row.category, categories: row.category ? { name: row.category } : null }));
        }
      }
      return runFinancialReasoning({ transactions: transactions as never[], currentMonth: typeof value.currentMonth === "string" ? value.currentMonth : undefined });
    },
    async output => ({ ok: Boolean(output && typeof output === "object" && "version" in (output as object)), reason: "Le raisonnement financier doit produire un résultat versionné." }));

  register("goal-lifecycle", "Goal Lifecycle", "Crée ou avance un cycle de vie d'objectif financier sans mutation implicite.", ["finance.read"],
    async input => {
      const value = objectInput(input);
      const lifecycle = createGoalLifecycle(String(value.goalId ?? "specialist-goal"), String(value.objective ?? value.text ?? "Objectif financier"), Array.isArray(value.successCriteria) ? value.successCriteria.map(String).slice(0, 8) : []);
      return typeof value.nextState === "string" ? advanceGoalLifecycle(lifecycle, value.nextState as never, String(value.nextAction ?? "vérifier le résultat")) : lifecycle;
    },
    async output => ({ ok: Boolean(output && typeof output === "object" && "state" in (output as object)), reason: "Le cycle d'objectif doit exposer un état valide." }));

  register("mobility-fuel", "Mobility Fuel", "Calcule consommation, coût carburant et coût de trajet à partir de paramètres explicites.", ["mobility.read"],
    async input => {
      const value = objectInput(input), distanceKm = number(value.distanceKm ?? value.distance), consumptionL100 = number(value.consumptionL100 ?? value.consumption), fuelPrice = number(value.fuelPrice ?? value.pricePerLiter);
      const liters = round(distanceKm * consumptionL100 / 100);
      return { distanceKm, consumptionL100, fuelPrice, liters, fuelCost: round(liters * fuelPrice), roundTrip: Boolean(value.roundTrip) ? { distanceKm: distanceKm * 2, liters: round(liters * 2), fuelCost: round(liters * 2 * fuelPrice) } : null };
    },
    async output => ({ ok: Boolean(output && typeof output === "object" && number((output as AnyRecord).liters) >= 0), reason: "Le calcul carburant doit rester numérique et non négatif." }));

  register("mobility-profile", "Mobility Profile", "Normalise un profil véhicule et calcule ses indicateurs dérivés sans modification.", ["mobility.read"],
    async input => {
      const value = objectInput(input), tankLiters = number(value.tankLiters ?? value.tank), consumptionL100 = number(value.consumptionL100 ?? value.consumption);
      return { vehicle: String(value.vehicle ?? value.model ?? "unknown"), tankLiters, consumptionL100, estimatedRangeKm: consumptionL100 > 0 ? round(tankLiters / consumptionL100 * 100) : null, profileValid: tankLiters > 0 && consumptionL100 > 0 };
    },
    async output => ({ ok: Boolean(output && typeof output === "object" && "profileValid" in (output as object)), reason: "Le profil mobilité doit être structuré." }));

  register("tavily-search", "Tavily Search", "Recherche web gouvernée avec classement de confiance et budget fournisseur.", ["research.read"],
    async input => {
      const value = objectInput(input), query = String(value.query ?? value.text ?? "").trim().slice(0, 500);
      if (!query) throw new Error("research_query_required");
      return discoverTrustedSources(query, Math.min(Math.max(number(value.limit, 5), 1), 8), ["brave", "web-cage", "bing"]);
    },
    async output => ({ ok: Boolean(output && typeof output === "object" && "status" in (output as object)), reason: "La recherche doit retourner un statut et des résultats gouvernés." }));

  register("tavily-research", "Tavily Research", "Recherche multi-source gouvernée, sans autorisation d'action externe.", ["research.read"],
    async input => {
      const value = objectInput(input), query = String(value.query ?? value.text ?? "").trim().slice(0, 500);
      if (!query) throw new Error("research_query_required");
      const result = await discoverTrustedSources(query, 5, ["brave", "web-cage", "bing"]);
      return { query, status: result.status, sources: result.results ?? [], usage: result.usage ?? [], limitations: ["Résultats dépendants des fournisseurs configurés.", "La recherche ne confère aucune autorité d'action."] };
    },
    async output => ({ ok: Boolean(output && typeof output === "object" && Array.isArray((output as AnyRecord).sources)), reason: "La recherche doit exposer une liste de sources." }));

  register("source-trust", "Source Trust", "Valide les URLs et prépare leur évaluation par le registre de confiance.", ["research.read"],
    async input => {
      const value = objectInput(input), sources = Array.isArray(value.sources) ? value.sources : [value.url ?? value.text];
      return sources.filter(Boolean).map(raw => { try { const url = new URL(String(raw)); const policy = getResearchDomainPolicy(url.hostname); return { url: url.toString(), host: url.hostname, valid: true, registered: policy.registered, allowed: policy.allowed, reason: policy.reason, trustScore: policy.entry?.trustScore ?? 0, sourceClass: policy.entry?.sourceClass ?? "UNREGISTERED" }; } catch { return { url: String(raw), valid: false }; } });
    },
    async output => ({ ok: Array.isArray(output), reason: "Le contrôle de confiance doit retourner une liste." }));

  register("data-deduplication", "Data Deduplication", "Détecte les doublons déterministes sans supprimer ni modifier les données.", ["data.read"],
    async input => {
      const rows = rowsInput(input), keys = rows.map(row => String(row.id ?? row.external_id ?? [row.date, row.booked_at, row.amount, row.currency, row.label, row.category].map(value => String(value ?? "").trim().toLowerCase()).join("|"))), counts = new Map<string, number>();
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
      const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count }));
      return { rowCount: rows.length, duplicateGroups: duplicates, duplicateRows: duplicates.reduce((sum, row) => sum + row.count - 1, 0), mutation: "none" };
    },
    async output => ({ ok: Boolean(output && typeof output === "object" && "duplicateRows" in (output as object)), reason: "La déduplication doit être purement diagnostique." }));

  register("anomaly-detection", "Anomaly Detection", "Détecte des valeurs atypiques par rapport à la médiane des données fournies.", ["data.read"],
    async input => {
      const rows = rowsInput(input), values = rows.map(row => number(row.amount ?? row.value)).filter(Number.isFinite).sort((a, b) => a - b);\n      const median = values.length ? (values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2) : 0;\n      const threshold = Math.max(Math.abs(median) * 3, 100);
      return { sampleSize: rows.length, median, threshold, anomalies: rows.filter(row => Math.abs(number(row.amount ?? row.value)) >= threshold).slice(0, 20), mutation: "none" };
    },
    async output => ({ ok: Boolean(output && typeof output === "object" && "sampleSize" in (output as object)), reason: "La détection d'anomalies doit être structurée." }));

  register("system-diagnostics", "System Diagnostics", "Diagnostique la configuration runtime sans modification.", ["system.read"],
    async () => ({ node: process.version, environment: process.env.NODE_ENV ?? "unknown", supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)), tavily: Boolean(process.env.TAVILY_API_KEY), brave: Boolean(process.env.BRAVE_SEARCH_API_KEY), fish: Boolean(process.env.FISH_API_KEY), diagnostics: "read_only" }),
    async output => ({ ok: Boolean(output && typeof output === "object" && "diagnostics" in (output as object)), reason: "Le diagnostic système doit rester en lecture seule." }));

  register("build-analysis", "Build Analysis", "Analyse les paramètres de build connus sans lancer de commande ni modifier le dépôt.", ["system.read"],
    async () => ({ next: "16.x", runtime: process.version, buildAnalysis: "static-runtime-check", recommendations: ["Exécuter npm run build dans CI pour validation complète.", "Conserver les secrets hors du dépôt."], execution: "no_process_spawn" }),
    async output => ({ ok: Boolean(output && typeof output === "object" && "execution" in (output as object)), reason: "L'analyse build ne doit pas exécuter de commande implicite." }));
}
