import { registerExecutableLiaSkill } from "../agent/skill-runtime.ts";
import type { LiaSkillExecutionContext } from "../agent/skill-runtime.ts";
import { registerChapter7SpecialistAdapters } from "./specialist-adapters.ts";

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
      kind: "draft", instruction: asText(input), publication: "blocked_until_human_approval",
    }),
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "Le brouillon doit être un objet structuré." }),
  });

  registerExecutableLiaSkill({
    id: "ux-copy",
    name: "UX Copy",
    description: "Produit des microcopies d'interface structurées sans publication.",
    capabilities: ["ux-copy", "microcopy"],
    requiredPermissions: [],
    riskClass: "read",
    execute: async (input: unknown) => {
      const text = asText(input);
      return { kind: "ux-copy", source: text, suggestions: ["Titre clair et orienté action", "Libellé de bouton explicite", "Message d'état court et compréhensible"], publication: "blocked_until_human_approval" };
    },
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "La microcopy doit rester structurée." }),
  });

  registerExecutableLiaSkill({
    id: "email-copy",
    name: "Email Copy",
    description: "Prépare un brouillon d'email sans envoi automatique.",
    capabilities: ["email-draft", "copywriting"],
    requiredPermissions: [],
    riskClass: "read",
    execute: async (input: unknown) => ({ kind: "email-draft", instruction: asText(input), sending: "blocked_until_human_approval" }),
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "Le brouillon d'email doit être structuré." }),
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
    id: "keyword-analysis",
    name: "Keyword Analysis",
    description: "Analyse lexicale locale d'un contenu fourni sans recherche externe.",
    capabilities: ["keywords", "content-analysis"],
    requiredPermissions: [],
    riskClass: "read",
    execute: async (input: unknown) => {
      const text = asText(input).toLocaleLowerCase("fr-FR").replace(/[^\p{L}\p{N}\s-]/gu, " ");
      const words = text.split(/\s+/).filter(word => word.length >= 4);
      const counts = new Map<string, number>();
      for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
      const keywords = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0, 15).map(([term,count]) => ({ term, count }));
      return { totalWords: words.length, keywords };
    },
    verify: async (output) => ({ ok: typeof output === "object" && output !== null && Array.isArray((output as Record<string, unknown>).keywords), reason: "L'analyse lexicale doit produire une liste de mots-clés." }),
  });

  registerExecutableLiaSkill({
    id: "metadata",
    name: "Metadata",
    description: "Propose des métadonnées SEO à partir d'un contenu fourni.",
    capabilities: ["metadata", "seo"],
    requiredPermissions: [],
    riskClass: "read",
    execute: async (input: unknown) => {
      const text = asText(input);
      const title = text.replace(/\s+/g, " ").trim().slice(0, 60);
      const description = text.replace(/\s+/g, " ").trim().slice(0, 155);
      return { title: title || "NEXORA", description: description || "Gestion financière intelligente avec LIA.", publication: "blocked_until_human_approval" };
    },
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "Les métadonnées doivent être structurées." }),
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
      return { rowCount: rows.length, duplicateCount: Math.max(0, rows.length - unique), emptyCount: rows.filter((row) => row == null || row === "").length, mutation: "none" };
    },
    verify: async (output) => ({ ok: typeof output === "object" && output !== null, reason: "Le contrôle qualité doit rester non destructif." }),
  });

  registerChapter7SpecialistAdapters();
}
