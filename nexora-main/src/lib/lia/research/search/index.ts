import { getResearchDomainPolicy } from "@/lib/lia/research/trust/registry";

export type SearchResult = {
  title:string;
  url:string;
  snippet?:string;
  publishedAt?:string|null;
  provider:string;
  trustScore?:number;
  sourceClass?:string;
  organization?:string;
  trusted?:boolean;
};
export type SearchProvider = { name:string; search(query:string, limit:number):Promise<SearchResult[]> };

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const cleanUrl=(raw:string)=>{try{const u=new URL(raw); if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return null; return u.toString();}catch{return null;}};

class BraveProvider implements SearchProvider {
 name="brave";
 async search(query:string,limit:number){
  const key=process.env.BRAVE_SEARCH_API_KEY;
  if(!key) throw new Error("search_provider_not_configured");
  const endpoint=process.env.BRAVE_SEARCH_API_URL||"https://api.search.brave.com/res/v1/web/search";
  const url=new URL(endpoint); url.searchParams.set("q",query); url.searchParams.set("count",String(clamp(limit,1,20)));
  const r=await fetch(url,{headers:{Accept:"application/json","X-Subscription-Token":key},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error(`search_upstream_${r.status}`);
  const data=await r.json() as {web?:{results?:Array<{title?:string,url?:string,description?:string,page_age?:string}>}};
  return (data.web?.results||[]).flatMap(x=>{const u=x.url?cleanUrl(x.url):null; return u&&x.title?[{title:x.title,url:u,snippet:x.description,publishedAt:x.page_age||null,provider:this.name}]:[]});
 }
}

class TavilyProvider implements SearchProvider {
 name="tavily";
 async search(query:string,limit:number){
  const key=process.env.TAVILY_API_KEY;
  if(!key) throw new Error("search_provider_not_configured");
  const endpoint=process.env.TAVILY_SEARCH_API_URL||"https://api.tavily.com/search";
  const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({api_key:key,query,max_results:clamp(limit,1,20),search_depth:"basic",include_answer:false}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error(`search_upstream_${r.status}`);
  const data=await r.json() as {results?:Array<{title?:string,url?:string,content?:string,published_date?:string}>};
  return (data.results||[]).flatMap(x=>{const u=x.url?cleanUrl(x.url):null; return u&&x.title?[{title:x.title,url:u,snippet:x.content,publishedAt:x.published_date||null,provider:this.name}]:[]});
 }
}

function configuredProviders():SearchProvider[]{
 const selected=(process.env.LIA_SEARCH_PROVIDER||"auto").trim().toLowerCase();
 const providers:SearchProvider[]=[];
 if(selected==="brave"||selected==="auto")providers.push(new BraveProvider());
 if(selected==="tavily"||selected==="auto")providers.push(new TavilyProvider());
 if(selected==="none")return [];
 if(!providers.length)throw new Error("unknown_search_provider");
 return providers;
}

export function getSearchProvider():SearchProvider|null{return configuredProviders()[0]||null;}

export function rankSearchResults(results:SearchResult[],limit=8){
 const out:SearchResult[]=[]; const seen=new Set<string>();
 for(const result of results){
  const u=cleanUrl(result.url); if(!u)continue;
  const parsed=new URL(u); const policy=getResearchDomainPolicy(parsed.hostname);
  const key=parsed.origin+parsed.pathname;
  if(seen.has(key))continue;
  seen.add(key);
  out.push({...result,url:u,trusted:policy.allowed,trustScore:policy.entry?.trustScore??45,sourceClass:policy.entry?.sourceClass??"UNREGISTERED",organization:policy.entry?.organization});
 }
 return out.sort((a,b)=>(b.trustScore??0)-(a.trustScore??0)).slice(0,clamp(limit,1,8));
}

export async function discoverTrustedSources(query:string,limit=5){
 const providers=configuredProviders();
 if(!providers.length)return {provider:null,providers:[],results:[],status:"not_configured" as const};
 const errors:string[]=[]; const raw:SearchResult[]=[];
 for(const provider of providers){
  try{const found=await provider.search(query,clamp(limit*3,3,20)); raw.push(...found);}catch(e){errors.push(`${provider.name}:${e instanceof Error?e.message:"search_failed"}`);}
 }
 const results=rankSearchResults(raw,limit);
 return {
  provider:results[0]?.provider||providers[0]?.name||null,
  providers:providers.map(p=>p.name),
  results,
  status:results.length?"ok" as const:errors.length?"search_failed" as const:"no_results" as const,
  errors:errors.length?errors:undefined,
 };
}
