import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { discoverTrustedSources } from "@/lib/lia/research/search";

export async function POST(request:Request){
 try{assertSameOrigin(request);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"forbidden"},{status:403});}
 const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"supabase_not_configured"},{status:503});
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body.query!=="string"||!body.query.trim())return NextResponse.json({error:"query_required"},{status:400});
 try{const result=await discoverTrustedSources(body.query,typeof body.limit==="number"?body.limit:5); return NextResponse.json({query:body.query.trim(),...result,executionAllowed:false});}
 catch(e){return NextResponse.json({error:"search_failed",detail:e instanceof Error?e.message:"unknown"},{status:502});}
}
