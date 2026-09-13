import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createStripeSetupIntent } from "@/lib/payments/stripe-server";

export async function POST(request:Request){
 try{assertSameOrigin(request);const supabase=await createClient();if(!supabase)return NextResponse.json({error:"Supabase indisponible."},{status:503});const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Non authentifié."},{status:401});
 const body=await request.json().catch(()=>({})) as {idempotencyKey?:string;paymentMethodTypes?:string[]}; if(!body.idempotencyKey)return NextResponse.json({error:"idempotencyKey requis."},{status:400});
 const admin=getSupabaseAdmin();if(!admin)return NextResponse.json({error:"Supabase serveur indisponible."},{status:503}); const c=await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id",user.id).single();if(c.error||!c.data)return NextResponse.json({error:"Client Stripe absent. Créez d'abord le client."},{status:409});
 const setup=await createStripeSetupIntent({customerId:c.data.stripe_customer_id,userId:user.id,paymentMethodTypes:body.paymentMethodTypes,idempotencyKey:body.idempotencyKey});
 return NextResponse.json({provider:"stripe",capability:"setup_intents",setupIntent:setup});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"SetupIntent Stripe impossible."},{status:500});}}
