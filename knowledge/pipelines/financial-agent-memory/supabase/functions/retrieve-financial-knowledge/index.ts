import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await req.json();
  const { query, embedding, top_k = 8, min_confidence = 0.65, domain = "financial_agents", agent_loop_run_id = null } = body;

  if (!query || !embedding) {
    return Response.json({ error: "query and embedding are required" }, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase.rpc("match_financial_knowledge", {
    query_embedding: embedding,
    match_count: top_k,
    min_confidence,
    requested_domain: domain
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // TODO: write retrieval records using the existing agent_loop_run/step IDs.
  // Retrieved knowledge is context/evidence only; it never grants authorization.

  return Response.json({ query, agent_loop_run_id, results: data ?? [] });
});
