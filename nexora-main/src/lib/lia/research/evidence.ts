export type EvidenceState = "supported" | "weak" | "contradictory" | "stale" | "unverified";
export type SourceTier = "official" | "standard" | "scientific" | "authority" | "vendor" | "reputable_secondary" | "community" | "unknown";
export type ResearchEvidence = {
  id: string;
  claim: string;
  source: { tier: SourceTier; title?: string; url?: string; publisher?: string; publishedAt?: string; observedAt?: string };
  supports?: boolean;
  confidence?: number;
  state?: EvidenceState;
};
export type ResearchResult = {
  query: string;
  generatedAt: string;
  claims: Array<{ claim: string; state: "verified" | "supported" | "uncertain" | "contradicted"; confidence: number; evidenceIds: string[] }>;
  evidence: ResearchEvidence[];
  unknowns: string[];
  contradictions: Array<{ evidenceIds: string[]; reason: string }>;
  staleEvidence: string[];
  corroboratedClaims: string[];
  minimumEvidenceMet: boolean;
  knowledgeGraphReady: boolean;
  activationAllowed: false;
  policy: "research_evidence_only";
};

const tierWeight: Record<SourceTier, number> = { official:100, authority:95, standard:95, scientific:90, vendor:80, reputable_secondary:65, community:30, unknown:10 };
const norm = (s:string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g," ").trim();
const similarity = (a:string,b:string) => { const A=new Set(norm(a).split(/\s+/).filter(x=>x.length>2)), B=new Set(norm(b).split(/\s+/).filter(x=>x.length>2)); if(!A.size||!B.size)return 0; let n=0; for(const w of A)if(B.has(w))n++; return n/(A.size+B.size-n); };
const stale = (e:ResearchEvidence, now:Date) => { if(!e.source.publishedAt)return false; const t=Date.parse(e.source.publishedAt); return Number.isFinite(t) && now.getTime()-t > 1000*60*60*24*365*3; };

/** Deterministic evidence adjudication. It evaluates supplied evidence; it does not browse or invent sources. */
export function evaluateResearch(query:string, evidence:ResearchEvidence[], now=new Date()):ResearchResult {
  const clean=evidence.slice(0,50).map(e=>({...e, confidence:Math.max(0,Math.min(100,e.confidence ?? tierWeight[e.source.tier])), state: stale(e,now)?"stale":(e.state ?? "unverified")}));
  const groups:Array<{claim:string, items:ResearchEvidence[]}>=[];
  for(const e of clean){ let g=groups.find(x=>similarity(x.claim,e.claim)>=0.72); if(!g){g={claim:e.claim,items:[]};groups.push(g)} else g.items.push(e); if(g.items.length===0)g.items=[e]; }
  const contradictions:Array<{evidenceIds:string[];reason:string}>=[];
  const claims=groups.map(g=>{
    const active=g.items.filter(e=>e.state!=="stale");
    const positive=active.filter(e=>e.supports!==false && e.state!=="contradictory");
    const negative=active.filter(e=>e.supports===false || e.state==="contradictory");
    const strongPos=positive.filter(e=>tierWeight[e.source.tier]>=80);
    const strongNeg=negative.filter(e=>tierWeight[e.source.tier]>=80);
    if(strongPos.length&&strongNeg.length){ contradictions.push({evidenceIds:[...strongPos,...strongNeg].map(e=>e.id),reason:"Des sources suffisamment fortes soutiennent des positions opposées; arbitrage requis."}); return {claim:g.claim,state:"contradicted" as const,confidence:Math.round(Math.max(...g.items.map(e=>e.confidence ?? 0))),evidenceIds:g.items.map(e=>e.id)}; }
    const corroborated=strongPos.length>=2 || (strongPos.length>=1 && positive.length>=2);
    const conf=Math.min(100,Math.round(Math.max(...positive.map(e=>e.confidence ?? 0),0) + (corroborated?10:0)));
    return {claim:g.claim,state:corroborated?"verified" as const:(positive.length?"supported" as const:"uncertain" as const),confidence:conf,evidenceIds:g.items.map(e=>e.id)};
  });
  const staleEvidence=clean.filter(e=>e.state==="stale").map(e=>e.id);
  const corroboratedClaims=claims.filter(c=>c.state==="verified").map(c=>c.claim);
  const unknowns=claims.filter(c=>c.state==="uncertain").map(c=>c.claim);
  const minimumEvidenceMet=clean.length>0 && claims.some(c=>c.state==="verified"||c.state==="supported") && contradictions.length===0;
  return {query,generatedAt:now.toISOString(),claims,evidence:clean,unknowns,contradictions,staleEvidence,corroboratedClaims,minimumEvidenceMet,knowledgeGraphReady:minimumEvidenceMet,activationAllowed:false,policy:"research_evidence_only"};
}
