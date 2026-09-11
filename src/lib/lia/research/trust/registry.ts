export type SourceClass = "OFFICIAL"|"AUTHORITY"|"STANDARD"|"SCIENTIFIC"|"VENDOR"|"REPUTABLE_SECONDARY"|"COMMUNITY";
export type DomainTrust = {
  domain:string;
  organization:string;
  sourceClass:SourceClass;
  trustScore:number;
  allowed:boolean;
  freshnessDays:number;
  notes?:string;
};

// Deterministic baseline registry. DB records can extend/override this server-side.
export const TRUSTED_DOMAIN_REGISTRY: readonly DomainTrust[] = [
  {domain:"eur-lex.europa.eu",organization:"EUR-Lex",sourceClass:"OFFICIAL",trustScore:98,allowed:true,freshnessDays:30},
  {domain:"ec.europa.eu",organization:"European Commission",sourceClass:"OFFICIAL",trustScore:98,allowed:true,freshnessDays:30},
  {domain:"europa.eu",organization:"European Union",sourceClass:"OFFICIAL",trustScore:97,allowed:true,freshnessDays:30},
  {domain:"edpb.europa.eu",organization:"European Data Protection Board",sourceClass:"AUTHORITY",trustScore:98,allowed:true,freshnessDays:30},
  {domain:"enisa.europa.eu",organization:"ENISA",sourceClass:"AUTHORITY",trustScore:98,allowed:true,freshnessDays:60},
  {domain:"cnil.fr",organization:"CNIL",sourceClass:"AUTHORITY",trustScore:98,allowed:true,freshnessDays:30},
  {domain:"anssi.gouv.fr",organization:"ANSSI",sourceClass:"AUTHORITY",trustScore:98,allowed:true,freshnessDays:60},
  {domain:"legifrance.gouv.fr",organization:"Légifrance",sourceClass:"OFFICIAL",trustScore:98,allowed:true,freshnessDays:30},
  {domain:"amf-france.org",organization:"AMF",sourceClass:"AUTHORITY",trustScore:97,allowed:true,freshnessDays:30},
  {domain:"acpr.banque-france.fr",organization:"ACPR",sourceClass:"AUTHORITY",trustScore:97,allowed:true,freshnessDays:30},
  {domain:"banque-france.fr",organization:"Banque de France",sourceClass:"AUTHORITY",trustScore:97,allowed:true,freshnessDays:60},
  {domain:"insee.fr",organization:"INSEE",sourceClass:"OFFICIAL",trustScore:97,allowed:true,freshnessDays:90},
  {domain:"iso.org",organization:"ISO",sourceClass:"STANDARD",trustScore:96,allowed:true,freshnessDays:180},
  {domain:"ietf.org",organization:"IETF",sourceClass:"STANDARD",trustScore:96,allowed:true,freshnessDays:180},
  {domain:"nist.gov",organization:"NIST",sourceClass:"AUTHORITY",trustScore:96,allowed:true,freshnessDays:90},
  {domain:"arxiv.org",organization:"arXiv",sourceClass:"SCIENTIFIC",trustScore:86,allowed:true,freshnessDays:365},
  {domain:"pubmed.ncbi.nlm.nih.gov",organization:"PubMed",sourceClass:"SCIENTIFIC",trustScore:92,allowed:true,freshnessDays:365},
  {domain:"openai.com",organization:"OpenAI",sourceClass:"VENDOR",trustScore:90,allowed:true,freshnessDays:90},
  {domain:"anthropic.com",organization:"Anthropic",sourceClass:"VENDOR",trustScore:90,allowed:true,freshnessDays:90}
];

const normalize=(value:string)=>value.trim().toLowerCase().replace(/^www\./,"").replace(/\.$/,"");
export function matchTrustedDomain(host:string, registry:readonly DomainTrust[]=TRUSTED_DOMAIN_REGISTRY):DomainTrust|undefined {
  const h=normalize(host);
  return [...registry].sort((a,b)=>b.domain.length-a.domain.length).find(e=>h===normalize(e.domain)||h.endsWith(`.${normalize(e.domain)}`));
}
export function getResearchDomainPolicy(host:string, registry:readonly DomainTrust[]=TRUSTED_DOMAIN_REGISTRY){
  const entry=matchTrustedDomain(host,registry);
  if(!entry) return {registered:false,allowed:false,reason:"domain_not_registered" as const};
  if(!entry.allowed) return {registered:true,allowed:false,reason:"domain_disabled" as const,entry};
  return {registered:true,allowed:true,reason:"allowed" as const,entry};
}
export function isEvidenceFresh(observedAt:string, freshnessDays:number, now=new Date()):boolean {
  const t=Date.parse(observedAt); if(!Number.isFinite(t)) return false;
  const age=(now.getTime()-t)/86400000; return age>=0 && age<=freshnessDays;
}
