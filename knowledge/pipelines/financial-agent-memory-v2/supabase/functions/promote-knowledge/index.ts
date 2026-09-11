import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
  const b=await req.json();
  if(!b.knowledge_id || !["validated","deprecated","conflicted","quarantined"].includes(b.decision))
    return Response.json({error:"invalid promotion request"},{status:400});
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Production must enforce caller permissions and source-authority validation.
  const {data,error}=await supabase.from("financial_knowledge_items")
    .update({status:b.decision,metadata:{promotion_reason:b.reason??null}})
    .eq("id",b.knowledge_id).select("id,status").single();
  if(error)return Response.json({error:error.message},{status:500});
  return Response.json(data);
});