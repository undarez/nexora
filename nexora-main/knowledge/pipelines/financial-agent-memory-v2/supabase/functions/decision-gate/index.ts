import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", {status:405});
  const b = await req.json();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let outcome = "BLOCK";
  if (b.authorization_present === true) {
    if (b.risk_level === "critical" || (b.risk_level === "high" && b.reversible === false)) outcome = "REQUIRE_APPROVAL";
    else if (b.risk_level === "high") outcome = "ALLOW_WITH_GUARDRAIL";
    else outcome = "ALLOW";
  }

  const rationale = {authorization_present:b.authorization_present === true, risk_level:b.risk_level, reversible:b.reversible, knowledge_is_not_authorization:true};
  const {data,error} = await supabase.from("agent_decision_gates").insert({
    agent_loop_run_id:b.agent_loop_run_id, agent_loop_step_id:b.agent_loop_step_id,
    action_type:b.action_type, risk_level:b.risk_level, reversible:b.reversible ?? true,
    amount:b.amount ?? null, currency:b.currency ?? "EUR", authorization_present:b.authorization_present ?? false,
    policy_id:b.policy_id ?? null, outcome, rationale,
    knowledge_ids:b.knowledge_ids ?? [], evidence_ids:b.evidence_ids ?? []
  }).select("id,outcome").single();

  if (error) return Response.json({error:error.message},{status:500});
  return Response.json(data);
});