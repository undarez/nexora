import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { synthesizeVoice, type VoiceProvider } from "@/lib/lia/voice/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request:Request){const origin=request.headers.get("origin");if(!origin)return true;try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}}

export async function POST(request:Request){
  if(!sameOrigin(request)) return NextResponse.json({error:"Origine refusée."},{status:403});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Authentification requise."},{status:401});
  const body=await request.json().catch(()=>null) as any;
  const text=typeof body?.text === "string" ? body.text.trim().slice(0,5000) : "";
  if(!text)return NextResponse.json({error:"Texte requis."},{status:400});
  const provider=body?.provider === "elevenlabs" ? "elevenlabs" : body?.provider === "hume" ? "hume" : undefined;
  try{
    const audio=await synthesizeVoice({text,provider:provider as VoiceProvider|undefined,voiceId:typeof body?.voiceId === "string" ? body.voiceId.slice(0,200) : undefined,voiceName:typeof body?.voiceName === "string" ? body.voiceName.slice(0,200) : undefined,style:typeof body?.style === "string" ? body.style.slice(0,1000) : undefined});
    return new NextResponse(new Uint8Array(audio),{status:200,headers:{"Content-Type":"audio/mpeg","Cache-Control":"private, no-store","X-Nexora-Voice":"1"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Synthèse vocale indisponible."},{status:503});}
}
