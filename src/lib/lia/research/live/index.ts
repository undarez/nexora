import { acquireSource } from "@/lib/lia/research/gateway";
import { evaluateResearch, type ResearchEvidence } from "@/lib/lia/research/evidence";
import { getResearchDomainPolicy } from "@/lib/lia/research/trust/registry";
import { planResearch, shouldStopResearch } from "@/lib/lia/research/planner";
import { discoverTrustedSources } from "@/lib/lia/research/search";

export type LiveResearchInput = { query: string; urls?: string[]; maxSources?: number; timeoutMs?: number; discover?: boolean; autonomous?: boolean };

export async function runLiveResearch(input: LiveResearchInput) {
  const query = input.query.trim();
  let urls = [...new Set((input.urls ?? []).map(u => u.trim()).filter(Boolean))].slice(0, Math.max(1, Math.min(8, input.maxSources ?? 5)));
  let discovery: {provider:string|null; results:Array<{title:string;url:string;snippet?:string;publishedAt?:string|null;provider:string}>; status:string} = {provider:null,results:[],status:"not_requested"};
  if (!urls.length && input.discover !== false) {
    discovery = await discoverTrustedSources(query, Math.max(1, Math.min(8, input.maxSources ?? 5)), [], input.autonomous ? "autonomous" : "user");
    urls = discovery.results.map(r => r.url);
  }
  const plan = planResearch(query, [], Math.min(5, urls.length || 1));
  const evidence: ResearchEvidence[] = [];
  const acquisitions: Array<Record<string, unknown>> = [];
  const blocked: Array<{ url: string; reason: string }> = [];

  for (const requestedUrl of urls) {
    try {
      const host = new URL(requestedUrl).hostname;
      const policy = getResearchDomainPolicy(host);
      if (!policy.allowed) {
        blocked.push({ url: requestedUrl, reason: policy.reason });
        continue;
      }
      if (!policy.entry) {
        blocked.push({ url: requestedUrl, reason: "domain_policy_entry_missing" });
        continue;
      }
      const entry = policy.entry;
      const acquired = await acquireSource({ url: requestedUrl, timeoutMs: input.timeoutMs, maxRedirects: 3, allowedHosts: [entry.domain] });
      acquisitions.push({ url: acquired.url, finalUrl: acquired.finalUrl, title: acquired.title, contentType: acquired.contentType, observedAt: acquired.observedAt, truncated: acquired.truncated, source: acquired.source });
      evidence.push({
        id: `live-${evidence.length + 1}`,
        claim: acquired.title ? `${acquired.title}: contenu acquis depuis une source de confiance.` : `Contenu acquis depuis ${acquired.finalUrl}.`,
        source: { url: acquired.finalUrl, tier: entry.sourceClass.toLowerCase() as ResearchEvidence["source"]["tier"], observedAt: acquired.observedAt },
        confidence: Math.max(0, Math.min(100, entry.trustScore)),
      });
      const checkpoint = evaluateResearch(query, evidence);
      const stop = shouldStopResearch({ strongSources: checkpoint.evidence.filter(e => ["official", "authority", "standard", "scientific"].includes(e.source.tier)).length, verifiedClaims: checkpoint.claims.filter(c => c.state === "verified").length, contradictions: checkpoint.contradictions.length, stepsCompleted: evidence.length, plan });
      if (stop.stop) break;
    } catch (error) {
      blocked.push({ url: requestedUrl, reason: error instanceof Error ? error.message : "acquisition_failed" });
    }
  }

  const result = evaluateResearch(query, evidence);
  return {
    ...result,
    plan,
    acquisitions,
    blocked,
    discovery,
    live: true,
    executedSources: evidence.length,
    nextAction: result.contradictions.length ? "Arbitrer la contradiction avant de conclure." : result.minimumEvidenceMet ? "Synthèse vérifiée disponible." : "Acquérir davantage de sources primaires ou autorités.",
  };
}
