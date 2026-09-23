import { registerExecutableLiaSkill } from "../agent/skill-runtime.ts";
import type { LiaSkillExecutionContext } from "../agent/skill-runtime.ts";

let registered = false;

function ensureObject(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? input as Record<string, unknown> : {};
}

function asText(input: unknown): string {
  const value = ensureObject(input).text ?? input;
  return String(value ?? "").trim().slice(0, 12000);
}

export function registerChapter7SafeSkills(): void {
  if (registered) return;
  registered = true;

  registerExecutableLiaSkill({
    id: "content-generation",
    name: "Content Generation",
    description: "Prépare un brouillon de contenu sans publication automatique.",
    capabilities: ["draft", "rewrite", "ux-copy"],
    requiredPermissions: [],
    riskClass: "read",
    execute: async (input: unknown, _context: LiaSkillExecutionContext) => ({
      kind: "draft",
      instruction: asText(input),
      publication: "blocked_until_human_approval",
    }),
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "Le brouillon doit être un objet structuré." }),
  });

  registerExecutableLiaSkill({
    id: "technical-seo",
    name: "Technical SEO Audit",
    description: "Analyse un contenu fourni et retourne une checklist SEO sans modifier le site.",
    capabilities: ["seo-audit", "metadata", "structure"],
    requiredPermissions: [],
    riskClass: "read",
    execute: async (input: unknown) => {
      const text = asText(input);
      const hasTitle = /<title>|\btitle\b/i.test(text);
      const hasDescription = /meta[^>]+description|\bdescription\b/i.test(text);
      const hasHeading = /<h1|\bh1\b/i.test(text);
      return { checks: { title: hasTitle, metaDescription: hasDescription, h1: hasHeading }, next: [!hasTitle && "title", !hasDescription && "meta_description", !hasHeading && "h1"].filter(Boolean) };
    },
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "L'audit SEO doit produire un résultat structuré." }),
  });

  registerExecutableLiaSkill({
    id: "system-health",
    name: "System Health",
    description: "Effectue un contrôle local et non destructif des prérequis système.",
    capabilities: ["health-check", "configuration-check"],
    requiredPermissions: [],
    riskClass: "read",
    execute: async () => ({
      runtime: process.version,
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      tavilyConfigured: Boolean(process.env.TAVILY_API_KEY),
      voiceConfigured: Boolean(process.env.FISH_API_KEY),
    }),
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "Le health check doit retourner un état structuré." }),
  });

  registerExecutableLiaSkill({
    id: "data-quality",
    name: "Data Quality",
    description: "Contrôle les données fournies sans les modifier.",
    capabilities: ["quality", "completeness", "anomaly-detection"],
    requiredPermissions: [],
    riskClass: "read",
    execute: async (input: unknown) => {
      const rows = Array.isArray(input) ? input : Array.isArray(ensureObject(input).rows) ? ensureObject(input).rows as unknown[] : [];
      const serialized = rows.map((row) => JSON.stringify(row));
      const unique = new Set(serialized).size;
      return {
        rowCount: rows.length,
        duplicateCount: Math.max(0, rows.length - unique),
        emptyCount: rows.filter((row) => row == null || row === "").length,
        mutation: "none",
      };
    },
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "Le contrôle qualité doit rester non destructif." }),
  });
}
