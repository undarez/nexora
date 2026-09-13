import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { MAIL_PROVIDERS } from "@/lib/integrations/mail";
export async function POST(request:Request){
  try{assertSameOrigin(request);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Requête refusée."},{status:403});}
  const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"Supabase n'est pas configuré."},{status:503});
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Authentification requise."},{status:401});
  const body=await request.json().catch(()=>({})); const provider=body?.provider as "gmail"|"outlook"; const meta=MAIL_PROVIDERS.find(p=>p.id===provider); if(!meta)return NextResponse.json({error:"Fournisseur email invalide."},{status:400});
  const configured=Boolean(process.env[meta.authEnv]);
  if(!configured)return NextResponse.json({status:"not_configured",provider,message:`${meta.name} est prêt à être connecté, mais les identifiants OAuth ${meta.authEnv} ne sont pas encore configurés sur le serveur.`},{status:503});
  return NextResponse.json({status:"oauth_required",provider,message:`Flux OAuth ${meta.api} à initialiser avec ${meta.name}.`,scopes:meta.defaultScopes});
}
