import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed",{status:405});
  const b=await req.json();
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data,error}=await supabase.from("agent_behaviour_events").insert({
    agent_loop_run_id:b.agent_loop_run_id??null, agent_loop_step_id:b.agent_loop_step_id??null,
    event_type:b.event_type, severity:b.severity??"info", metadata:b.metadata??{}
  }).select("id").single();
  if(error)return Response.json({error:error.message},{status:500});
  return Response.json({ok:true,id:data.id});
});