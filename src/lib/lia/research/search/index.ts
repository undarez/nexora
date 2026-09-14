import { getResearchDomainPolicy } from "@/lib/lia/research/trust/registry";

export type SearchResult = { title:string; url:string; snippet?:string; publishedAt?:string|null; provider:string; trustScore?:number; sourceClass?:string; organization?:string; trusted?:boolean };
export type SearchProvider = { name:string; search(query:string, limit:number):Promise<SearchResult[]> };
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const cleanUrl=(raw:string)=>{try{const u=new URL(raw);if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return null;return u.toString();}catch{return null;}};
const stripHtml=(value:string)=>value.replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();

class BraveProvider implements SearchProvider {
 name="brave";
 async search(query:string,limit:number){const key=process.env.BRAVE_SEARCH_API_KEY;if(!key)throw new Error("search_provider_not_configured");const endpoint=process.env.BRAVE_SEARCH_API_URL||"https://api.search.brave.com/res/v1/web/search";const url=new URL(endpoint);url.searchParams.set("q",query);url.searchParams.set("count",String(clamp(limit,1,20)));const r=await fetch(url,{headers:{Accept:"application/json","X-Subscription-Token":key},signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`search_upstream_${r.status}`);const data=await r.json() as {web?:{results?:Array<{title?:string,url?:string,description?:string,page_age?:string}>}};return (data.web?.results||[]).flatMap(x=>{const u=x.url?cleanUrl(x.url):null;return u&&x.title?[{title:x.title,url:u,snippet:x.description,publishedAt:x.page_age||null,provider:this.name}]:[]});}
}
class TavilyProvider implements SearchProvider {
 name="tavily";
 async search(query:string,limit:number){const key=process.env.TAVILY_API_KEY;if(!key)throw new Error("search_provider_not_configured");const endpoint=process.env.TAVILY_SEARCH_API_URL||"https://api.tavily.com/search";const r=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify({api_key:key,query,max_results:clamp(limit,1,20),search_depth:"basic",include_answer:false}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`search_upstream_${r.status}`);const data=await r.json() as {results?:Array<{title?:string,url?:string,content?:string,published_date?:string}>};return (data.results||[]).flatMap(x=>{const u=x.url?cleanUrl(x.url):null;return u&&x.title?[{title:x.title,url:u,snippet:x.content,publishedAt:x.published_date||null,provider:this.name}]:[]});}
}

class DuckDuckGoWorker implements SearchProvider {
 name="web-cage";
 async search(query:string,limit:number){
  const endpoint=process.env.LIA_WEB_SEARCH_ENDPOINT||"https://html.duckduckgo.com/html/";
  const url=new URL(endpoint);url.searchParams.set("q",query);url.searchParams.set("kl","fr-fr");
  const r=await fetch(url,{headers:{Accept:"text/html","User-Agent":"NEXORA-LIA-WebWorker/1.0"},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error(`web_search_upstream_${r.status}`);
  const html=(await r.text()).slice(0,900_000);
  const results:SearchResult[]=[];
  const blockRe=/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>)?/gi;
  for(const match of html.matchAll(blockRe)){
   if(results.length>=clamp(limit,1,8))break;
   let raw=match[1];try{const decoded=decodeURIComponent(raw);const uddg=decoded.match(/[?&]uddg=([^&]+)/);if(uddg)raw=decodeURIComponent(uddg[1]);}catch{}
   const u=cleanUrl(raw);if(!u)continue;
   results.push({title:stripHtml(match[2]),url:u,snippet:match[3]?stripHtml(match[3]):undefined,provider:this.name});
  }
  return results;
 }
}

/** Keyless fallback used only when the primary search providers are unavailable. */
class BingWorker implements SearchProvider {
 name="web-cage-bing";
 async search(query:string,limit:number){
  const url=new URL("https://www.bing.com/search");url.searchParams.set("q",query);url.searchParams.set("count",String(clamp(limit,1,8)));url.searchParams.set("setlang","fr-FR");
  const r=await fetch(url,{headers:{Accept:"text/html","User-Agent":"NEXORA-LIA-WebWorker/1.0"},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error(`bing_search_upstream_${r.status}`);
  const html=(await r.text()).slice(0,900_000);const results:SearchResult[]=[];
  const re=/<li[^>]+class=["'][^"']*b_algo[^"']*["'][^>]*>[\s\S]*?<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?[\s\S]*?<\/li>/gi;
  for(const match of html.matchAll(re)){
   if(results.length>=clamp(limit,1,8))break;
   const u=cleanUrl(match[1]);if(!u)continue;
   results.push({title:stripHtml(match[2]),url:u,snippet:match[3]?stripHtml(match[3]):undefined,provider:this.name});
  }
  return results;
 }
}

function configuredProviders():SearchProvider[]{
 const selected=(process.env.LIA_SEARCH_PROVIDER||"auto").trim().toLowerCase();
 if(selected==="none")return [];
 const providers:SearchProvider[]=[];
 if(selected==="brave"||selected==="auto")providers.push(new BraveProvider());
 if(selected==="tavily"||selected==="auto")providers.push(new TavilyProvider());
 if(selected==="web-cage"||selected==="auto")providers.push(new DuckDuckGoWorker());
 if(selected==="bing"||selected==="auto")providers.push(new BingWorker());
 if(!providers.length)throw new Error("unknown_search_provider");
 return providers;
}
export function getSearchProvider():SearchProvider|null{return configuredProviders()[0]||null;}
export function rankSearchResults(results:SearchResult[],limit=8){const out:SearchResult[]=[];const seen=new Set<string>();for(const result of results){const u=cleanUrl(result.url);if(!u)continue;const parsed=new URL(u);const policy=getResearchDomainPolicy(parsed.hostname);const key=parsed.origin+parsed.pathname;if(seen.has(key))continue;seen.add(key);out.push({...result,url:u,trusted:policy.allowed,trustScore:policy.entry?.trustScore??45,sourceClass:policy.entry?.sourceClass??"UNREGISTERED",organization:policy.entry?.organization});}return out.sort((a,b)=>(b.trustScore??0)-(a.trustScore??0)).slice(0,clamp(limit,1,8));}
export async function discoverTrustedSources(query:string,limit=5){const providers=configuredProviders();if(!providers.length)return {provider:null,providers:[],results:[],status:"not_configured" as const};const errors:string[]=[];const raw:SearchResult[]=[];const settled=await Promise.allSettled(providers.map(p=>p.search(query,clamp(limit*3,3,20))));settled.forEach((result,index)=>{if(result.status==="fulfilled")raw.push(...result.value);else errors.push(`${providers[index].name}:${result.reason instanceof Error?result.reason.message:"search_failed"}`);});const results=rankSearchResults(raw,limit);return {provider:results[0]?.provider||providers[0]?.name||null,providers:providers.map(p=>p.name),results,status:results.length?"ok" as const:errors.length?"search_failed" as const:"no_results" as const,errors:errors.length?errors:undefined};}
