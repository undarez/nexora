import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await req.json();
  const { knowledge_id, decision, reason } = body;

  if (!knowledge_id || !["validated", "deprecated", "conflicted"].includes(decision)) {
    return Response.json({ error: "invalid promotion request" }, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // TODO: enforce caller authorization and source-authority rules.
  const { error } = await supabase
    .from("financial_knowledge_items")
    .update({
      status: decision,
      metadata: { promotion_reason: reason ?? null }
    })
    .eq("id", knowledge_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, knowledge_id, decision });
});
