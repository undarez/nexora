import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
  const b=await req.json();
  if(!b.embedding)return Response.json({error:"embedding is required"},{status:400});
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data,error}=await supabase.rpc("match_financial_knowledge",{
    query_embedding:b.embedding, match_count:b.top_k??8,
    min_confidence:b.min_confidence??0.65, requested_domain:b.domain??"financial_agents"
  });
  if(error)return Response.json({error:error.message},{status:500});
  return Response.json({query:b.query??null,agent_loop_run_id:b.agent_loop_run_id??null,results:data??[]});
});