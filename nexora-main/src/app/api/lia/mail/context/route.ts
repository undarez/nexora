import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { mailConnectionSummary } from "@/lib/integrations/mail";
export async function GET(request:Request){
  try{assertSameOrigin(request);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Requête refusée."},{status:403});}
  const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"Supabase n'est pas configuré."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentification requise."},{status:401});
  const {data,error}=await supabase.from("lia_mail_connections").select("provider,email,status,scopes,last_sync_at").eq("user_id",user.id);
  if(error && !/relation .*lia_mail_connections.*does not exist/i.test(error.message))return NextResponse.json({error:error.message},{status:500});
  const connections=(data??[]).map((x:any)=>({provider:x.provider,email:x.email??null,status:x.status,scopes:x.scopes??[],lastSyncAt:x.last_sync_at??null}));
  return NextResponse.json({connections:mailConnectionSummary(connections),policy:{metadataFirst:true,bodiesOptIn:false,attachmentsNotFetchedByDefault:true}});
}
