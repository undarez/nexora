import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createClient as createAdminClient} from "@supabase/supabase-js";
import {assertSameOrigin} from "@/lib/security/csrf";
import {acquireSource} from "@/lib/lia/research/gateway";
import {getResearchDomainPolicy} from "@/lib/lia/research/trust/registry";

export async function POST(request:Request){
 try{assertSameOrigin(request)}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"forbidden"},{status:403})}
 const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"supabase_not_configured"},{status:503}); const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const body=await request.json().catch(()=>null); if(!body||typeof body.url!=="string")return NextResponse.json({error:"url_required"},{status:400});
 try{
  const requestedHost=new URL(body.url).hostname;
  const domainPolicy=getResearchDomainPolicy(requestedHost);
  if(domainPolicy.entry&&!domainPolicy.allowed)return NextResponse.json({error:"research_domain_not_allowed",reason:domainPolicy.reason,domain:requestedHost},{status:403});
  const entry=domainPolicy.entry;
  const result=await acquireSource({url:body.url,maxBytes:body.maxBytes,timeoutMs:body.timeoutMs,maxRedirects:body.maxRedirects,allowedHosts:entry?[entry.domain]:[]});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url&&secret){const admin=createAdminClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});const {error}=await admin.from("lia_research_acquisitions").insert({user_id:user.id,requested_url:result.url,final_url:result.finalUrl,status:result.status,content_type:result.contentType,title:result.title||null,text:result.text,observed_at:result.observedAt,redirects:result.redirects,truncated:result.truncated,source_host:result.source.host,execution_allowed:false});if(error)return NextResponse.json({error:"acquisition_persistence_failed",detail:error.message},{status:500});}
  return NextResponse.json({...result,trust:{registered:domainPolicy.registered,sourceClass:entry?.sourceClass||"UNREGISTERED",trustScore:entry?.trustScore??45,organization:entry?.organization||null,freshnessDays:entry?.freshnessDays??7}});
 }catch(e){return NextResponse.json({error:"source_acquisition_blocked",reason:e instanceof Error?e.message:"unknown"},{status:400})}
}
