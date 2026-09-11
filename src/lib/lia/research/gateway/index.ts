import dns from "node:dns/promises";
import net from "node:net";

export type AcquisitionRequest = { url:string; maxBytes?:number; timeoutMs?:number; maxRedirects?:number; allowedHosts?:string[] };
export type AcquisitionResult = { url:string; finalUrl:string; status:number; contentType:string; title?:string; text:string; observedAt:string; redirects:number; truncated:boolean; source:{host:string; protocol:"http"|"https"}; executionAllowed:false };

const DEFAULT_MAX_BYTES=750_000, DEFAULT_TIMEOUT=12_000, DEFAULT_REDIRECTS=3;
const blockedHostnames=new Set(["localhost","localhost.localdomain","metadata.google.internal"]);
const privateIPv4=(ip:string)=>{const p=ip.split(".").map(Number); return p[0]===10 || p[0]===127 || (p[0]===172&&p[1]>=16&&p[1]<=31) || (p[0]===192&&p[1]===168) || (p[0]===169&&p[1]===254) || p[0]===0;};
const privateIPv6=(ip:string)=>{const x=ip.toLowerCase(); return x==="::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80:") || x.startsWith("::ffff:127.") || x.startsWith("::ffff:10.") || x.startsWith("::ffff:192.168.");};
function hostAllowed(host:string, allowed:string[]){if(!allowed.length)return true; const h=host.toLowerCase().replace(/^www\./,""); return allowed.some(x=>{const a=x.toLowerCase().replace(/^www\./,""); return h===a || h.endsWith(`.${a}`)});}
export async function validateResearchUrl(raw:string, allowedHosts:string[]=[]){
 const parsed=new URL(raw.trim());
 if(!["http:","https:"].includes(parsed.protocol))throw new Error("https_or_http_required");
 if(parsed.username||parsed.password)throw new Error("credentials_in_url_blocked");
 if(!hostAllowed(parsed.hostname,allowedHosts))throw new Error("host_not_allowed");
 await assertPublicHost(parsed.hostname);
 return parsed;
}

async function assertPublicHost(hostname:string){
 const h=hostname.toLowerCase().replace(/\.$/,"");
 if(blockedHostnames.has(h))throw new Error("blocked_host");
 if(net.isIP(h)){ if(net.isIP(h)===4&&privateIPv4(h))throw new Error("private_ip_blocked"); if(net.isIP(h)===6&&privateIPv6(h))throw new Error("private_ip_blocked"); return; }
 const answers=await dns.lookup(h,{all:true});
 if(!answers.length)throw new Error("dns_no_answer");
 for(const a of answers){if((a.family===4&&privateIPv4(a.address))||(a.family===6&&privateIPv6(a.address)))throw new Error("private_ip_blocked");}
}
function extractTitle(html:string){const m=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return m?.[1]?.replace(/\s+/g," ").trim().slice(0,300);}
function htmlToText(input:string){return input.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/\s+/g," ").trim();}
export async function acquireSource(input:AcquisitionRequest):Promise<AcquisitionResult>{
 const maxBytes=Math.max(10_000,Math.min(1_500_000,input.maxBytes??DEFAULT_MAX_BYTES)); const timeout=Math.max(2_000,Math.min(20_000,input.timeoutMs??DEFAULT_TIMEOUT)); const maxRedirects=Math.max(0,Math.min(DEFAULT_REDIRECTS,input.maxRedirects??DEFAULT_REDIRECTS));
 let current=input.url.trim(); if(!/^https?:\/\//i.test(current))throw new Error("https_or_http_required"); let redirects=0;
 while(true){
  const parsed=await validateResearchUrl(current,input.allowedHosts??[]);
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeout);
  let response:Response; try{response=await fetch(current,{method:"GET",redirect:"manual",signal:controller.signal,headers:{"user-agent":"GererFinance-LIA-Research/1.0","accept":"text/html, text/plain, application/pdf;q=0.9,*/*;q=0.5"}})}finally{clearTimeout(timer)}
  if([301,302,303,307,308].includes(response.status)){if(redirects>=maxRedirects)throw new Error("redirect_limit"); const loc=response.headers.get("location"); if(!loc)throw new Error("redirect_without_location"); current=new URL(loc,current).toString(); redirects++; continue;}
  if(!response.ok)throw new Error(`upstream_http_${response.status}`);
  const contentType=(response.headers.get("content-type")||"application/octet-stream").split(";")[0].toLowerCase();
  if(!["text/html","text/plain","application/xhtml+xml","application/json","application/pdf"].includes(contentType))throw new Error("unsupported_content_type");
  const reader=response.body?.getReader(); if(!reader)throw new Error("empty_response"); const chunks:Uint8Array[]=[]; let total=0,truncated=false;
  while(true){const {done,value}=await reader.read(); if(done)break; if(value){const remaining=maxBytes-total; if(value.byteLength>remaining){chunks.push(value.slice(0,remaining)); total+=remaining; truncated=true; await reader.cancel(); break;} chunks.push(value); total+=value.byteLength;}}
  const bytes=new Uint8Array(total); let offset=0; for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;} const raw=new TextDecoder().decode(bytes); const text=contentType==="text/html"||contentType==="application/xhtml+xml"?htmlToText(raw):raw;
  return {url:input.url,finalUrl:current,status:response.status,contentType,title:contentType.includes("html")?extractTitle(raw):undefined,text,observedAt:new Date().toISOString(),redirects,truncated,source:{host:parsed.hostname,protocol:parsed.protocol.replace(":","") as "http"|"https"},executionAllowed:false};
 }
}
