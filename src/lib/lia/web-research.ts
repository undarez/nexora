import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";

const MAX_RESULTS = 6;
const MAX_PAGE_CHARS = 30000;
const MAX_SEARCH_CHARS = 1200;
const USER_AGENT = "NexoraResearch/1.0 (+https://nexora.app; respectful automated research)";

function isPrivateIp(address: string) {
  const value = address.toLowerCase();
  return value === "::1" || value.startsWith("127.") || value.startsWith("10.") || value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value) || value.startsWith("169.254.") || value.startsWith("0.") ||
    value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

async function assertSafePublicUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("URL invalide."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Seuls HTTP(S) sont autorisés.");
  if (url.username || url.password) throw new Error("Les URLs avec identifiants sont interdites.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Hôte local interdit.");
  const records = await lookup(host, { all: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error("Destination réseau privée interdite.");
  return url;
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ").trim().slice(0, MAX_PAGE_CHARS);
}

function extractMeta(html: string, name: string) {
  const match = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"));
  return match?.[1]?.trim() || undefined;
}

async function fetchPublicPage(rawUrl: string, timeoutMs = 15000) {
  let url = await assertSafePublicUrl(rawUrl);
  for (let redirect = 0; redirect < 3; redirect++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/pdf;q=0.8,text/plain;q=0.7,*/*;q=0.2" }, redirect: "manual", cache: "no-store", signal: controller.signal });
    } finally { clearTimeout(timer); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirection sans destination.");
      url = await assertSafePublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Source inaccessible (${response.status}).`);
    const contentType = response.headers.get("content-type") || "";
    if (!/(text\/html|application\/xhtml\+xml|text\/plain)/i.test(contentType)) throw new Error("Type de document non pris en charge pour l'extraction texte.");
    const html = await response.text();
    const title = extractMeta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || url.hostname;
    const description = extractMeta(html, "description") || extractMeta(html, "og:description");
    return { url: url.toString(), title, description, content: htmlToText(html), contentType };
  }
  throw new Error("Trop de redirections.");
}

async function searchDuckDuckGo(query: string) {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.slice(0, MAX_SEARCH_CHARS))}`;
  const response = await fetch(endpoint, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, redirect: "manual", cache: "no-store" });
  if (!response.ok) throw new Error(`Recherche web indisponible (${response.status}).`);
  const html = await response.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const pattern = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && results.length < MAX_RESULTS) {
    const href = match[1];
    const title = htmlToText(match[2]);
    if (!/^https?:\/\//i.test(href)) continue;
    const start = match.index + match[0].length;
    const chunk = html.slice(start, start + 1600);
    const snippet = htmlToText(chunk).slice(0, 500);
    results.push({ title, url: href, snippet });
  }
  return results;
}

export async function researchWeb(query: string, options?: { maxResults?: number; fetchTop?: number }) {
  const clean = query.trim().slice(0, MAX_SEARCH_CHARS);
  if (!clean) throw new Error("Une requête de recherche est nécessaire.");
  const searchResults = await searchDuckDuckGo(clean);
  const limit = Math.min(MAX_RESULTS, Math.max(1, options?.fetchTop ?? 3), searchResults.length);
  const documents = [] as Array<{ title: string; url: string; snippet: string; content?: string; error?: string }>;
  for (const result of searchResults.slice(0, limit)) {
    try {
      const page = await fetchPublicPage(result.url);
      documents.push({ ...result, title: page.title || result.title, content: page.content });
    } catch (error) {
      documents.push({ ...result, error: error instanceof Error ? error.message : "Source non récupérée." });
    }
  }
  return { query: clean, results: documents };
}

/** Persist researched sources using the existing knowledge model. Service-role is only used for the write path. */
export async function persistResearch(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  results: Array<{ title: string; url: string; snippet?: string; content?: string; error?: string }>,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Supabase service role indisponible pour la mémorisation.");
  const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const saved: string[] = [];
  for (const item of results.slice(0, MAX_RESULTS)) {
    if (!item.content || item.content.length < 80 || item.error) continue;
    const normalizedUrl = new URL(item.url).toString();
    const hash = createHash("sha256").update(item.content).digest("hex");
    const { data: source, error: sourceError } = await admin.from("knowledge_sources").upsert({
      url: normalizedUrl, title: item.title.slice(0, 500), source_type: "web_research", trust_score: 60, last_checked_at: new Date().toISOString(),
    }, { onConflict: "url" }).select("id").single();
    if (sourceError || !source) continue;
    const { data: knowledge, error } = await admin.from("knowledge_items").insert({
      source_id: source.id, title: item.title.slice(0, 500), summary: (item.snippet || item.content.slice(0, 600)).slice(0, 2000), kind: "web_article",
      confidence: 60, content_hash: hash, content: item.content, source_url: normalizedUrl,
      source_metadata: { query, user_id: userId, retrieval_method: "direct_web", retrieved_at: new Date().toISOString() }, retrieved_at: new Date().toISOString(),
    }).select("id").single();
    if (!error && knowledge) saved.push(knowledge.id);
  }
  return { savedCount: saved.length, knowledgeIds: saved };
}
