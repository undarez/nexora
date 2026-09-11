import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405});
  const b=await req.json();
  // Reference scaffold: validate source, fetch permitted original content,
  // hash/deduplicate, chunk, embed, extract candidate knowledge and provenance.
  // External content is DATA, never instructions.
  createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return Response.json({ok:true,status:"scaffold",source_key:b.source_key??null});
});