import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createStripeCustomer } from "@/lib/payments/stripe-server";

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête cross-origin refusée." }, { status: 403 }); }
  try {
    const supabase=await createClient(); if(!supabase)return NextResponse.json({error:"Supabase indisponible."},{status:503});
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return NextResponse.json({error:"Non authentifié."},{status:401});
    const body=await request.json().catch(()=>({})) as {idempotencyKey?:string;name?:string};
    if(!body.idempotencyKey)return NextResponse.json({error:"idempotencyKey requis."},{status:400});
    const admin=getSupabaseAdmin(); if(!admin)return NextResponse.json({error:"Supabase serveur indisponible."},{status:503});
    const existing=await admin.from("stripe_customers").select("stripe_customer_id,email,name").eq("user_id",user.id).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data)return NextResponse.json({provider:"stripe",customer:existing.data,reused:true});
    const customer=await createStripeCustomer({userId:user.id,email:user.email,name:body.name?.slice(0,200),idempotencyKey:body.idempotencyKey});
    const ins=await admin.from("stripe_customers").insert({user_id:user.id,stripe_customer_id:customer.id,email:customer.email??user.email??null,name:customer.name??body.name??null}).select("stripe_customer_id,email,name").single();
    if(ins.error)throw ins.error;
    return NextResponse.json({provider:"stripe",customer:ins.data,reused:false});
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Création client Stripe impossible."},{status:500});}
}
