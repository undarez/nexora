import { getResearchDomainPolicy } from "@/lib/lia/research/trust/registry";

export type SearchResult = { title:string; url:string; snippet?:string; publishedAt?:string|null; provider:string };
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
  const r=await fetch(url,{headers:{Accept:"application/json", "X-Subscription-Token":key},signal:AbortSignal.timeout(10000)});
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

export function getSearchProvider():SearchProvider|null{
 const selected=(process.env.LIA_SEARCH_PROVIDER||"").trim().toLowerCase();
 if(selected==="brave")return new BraveProvider();
 if(selected==="tavily")return new TavilyProvider();
 if(selected==="none"||!selected)return null;
 throw new Error("unknown_search_provider");
}

export function filterTrustedSearchResults(results:SearchResult[],limit=8){
 const out:SearchResult[]=[]; const seen=new Set<string>();
 for(const result of results){
  const u=cleanUrl(result.url); if(!u)continue;
  const host=new URL(u).hostname; const policy=getResearchDomainPolicy(host);
  if(!policy.allowed)continue;
  const key=new URL(u).origin+new URL(u).pathname;
  if(seen.has(key))continue; seen.add(key); out.push({...result,url:u}); if(out.length>=clamp(limit,1,8))break;
 }
 return out;
}

export async function discoverTrustedSources(query:string,limit=5){
 const provider=getSearchProvider();
 if(!provider)return {provider:null,results:[],status:"not_configured" as const};
 const raw=await provider.search(query,clamp(limit*2,2,20));
 const results=filterTrustedSearchResults(raw,limit);
 return {provider:provider.name,results,status:results.length?"ok" as const:"no_trusted_results" as const};
}
